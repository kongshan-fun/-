#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""最小 QR 编码器（字节模式 · 纠错 M · 版本 6 · 自动选掩码），零第三方依赖。
产出 512×512 的 RGB PNG（整数模块尺寸，锐利不模糊），供 TapTap 自测二维码使用。

自测码口径（与历史版本一致，由 tools/qr_read.py 反解确认）：
    https://www.taptap.cn/qrcode/miniapp?id=<miniapp_id>&type=develop&version_id=<package_id>

用法:
    python tools/qr_write.py "<文本>" <输出.png>
    python tools/qr_write.py --selftest <miniapp_id> <version_id> <输出.png>
"""
import sys
import zlib
import struct

VERSION = 6
SIZE = 17 + 4 * VERSION          # 41
# 版本 6 / 纠错 M：4 块 × 27 数据码字，每块 16 个纠错码字，共 172 码字
BLOCKS, DATA_PER_BLOCK, ECC_PER_BLOCK = 4, 27, 16
DATA_CW = BLOCKS * DATA_PER_BLOCK          # 108
TOTAL_CW = DATA_CW + BLOCKS * ECC_PER_BLOCK  # 172
ECL_BITS = 0b00                             # M
MAX_BYTES = (DATA_CW * 8 - 12) // 8         # 106

ALIGN_POS = [6, 34]


# ---------------- GF(256) ----------------
EXP = [0] * 512
LOG = [0] * 256
_x = 1
for _i in range(255):
    EXP[_i] = _x
    LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    EXP[_i] = EXP[_i - 255]


def gf_mul(a, b):
    if a == 0 or b == 0:
        return 0
    return EXP[LOG[a] + LOG[b]]


def rs_ecc(data, nsym):
    gen = [1]
    for i in range(nsym):
        nxt = [0] * (len(gen) + 1)
        for j, g in enumerate(gen):
            nxt[j] ^= g
            nxt[j + 1] ^= gf_mul(g, EXP[i])
        gen = nxt
    rem = list(data) + [0] * nsym
    for i in range(len(data)):
        coef = rem[i]
        if coef:
            for j, g in enumerate(gen):
                rem[i + j] ^= gf_mul(g, coef)
    return rem[len(data):]


# ---------------- 位流 ----------------
def build_data_codewords(payload):
    bits = []
    def put(val, n):
        for i in range(n - 1, -1, -1):
            bits.append((val >> i) & 1)
    put(0b0100, 4)                    # 字节模式
    put(len(payload), 8)              # 版本 6 < 10，长度字段 8 位
    for b in payload:
        put(b, 8)
    cap = DATA_CW * 8
    put(0, min(4, cap - len(bits)))   # 终止符
    while len(bits) % 8:
        bits.append(0)
    cw = [int(''.join(map(str, bits[i:i + 8])), 2) for i in range(0, len(bits), 8)]
    pad = 0xEC
    while len(cw) < DATA_CW:
        cw.append(pad)
        pad = 0x11 if pad == 0xEC else 0xEC
    assert len(cw) == DATA_CW
    return cw


def add_ecc(data_cw):
    blocks = [data_cw[i * DATA_PER_BLOCK:(i + 1) * DATA_PER_BLOCK] for i in range(BLOCKS)]
    eccs = [rs_ecc(b, ECC_PER_BLOCK) for b in blocks]
    out = []
    for i in range(DATA_PER_BLOCK):
        for b in blocks:
            out.append(b[i])
    for i in range(ECC_PER_BLOCK):
        for e in eccs:
            out.append(e[i])
    assert len(out) == TOTAL_CW
    return out


# ---------------- 矩阵 ----------------
def make_matrix():
    return [[None] * SIZE for _ in range(SIZE)]   # None = 未占用


def place_function(m):
    # 定位符 + 分隔符
    def finder(r0, c0):
        for dr in range(-1, 8):
            for dc in range(-1, 8):
                r, c = r0 + dr, c0 + dc
                if not (0 <= r < SIZE and 0 <= c < SIZE):
                    continue
                inside = 0 <= dr <= 6 and 0 <= dc <= 6
                dark = inside and (dr in (0, 6) or dc in (0, 6) or (2 <= dr <= 4 and 2 <= dc <= 4))
                m[r][c] = 1 if dark else 0
    finder(0, 0); finder(0, SIZE - 7); finder(SIZE - 7, 0)
    # 定时图形
    for i in range(8, SIZE - 8):
        m[6][i] = 1 if i % 2 == 0 else 0
        m[i][6] = 1 if i % 2 == 0 else 0
    # 校正图形（版本 6 只有 (34,34) 一个不与定位符重叠）
    for r in ALIGN_POS:
        for c in ALIGN_POS:
            if (r == 6 and c == 6) or (r == 6 and c == SIZE - 7) or (r == SIZE - 7 and c == 6):
                continue
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    dark = max(abs(dr), abs(dc)) != 1
                    m[r + dr][c + dc] = 1 if dark else 0
    # 格式信息区先占位（稍后填），并画固定暗模块
    reserved = [[False] * SIZE for _ in range(SIZE)]
    def res(r, c):
        reserved[r][c] = True
    for i in range(9):
        res(8, i); res(i, 8)
    for i in range(8):
        res(8, SIZE - 1 - i)
    for i in range(7):
        res(SIZE - 1 - i, 8)
    m[SIZE - 8][8] = 1
    res(SIZE - 8, 8)
    # 已画好的功能图形也标成保留
    for i in range(9):
        for j in range(9):
            reserved[i][j] = True
    for i in range(9):
        for j in range(SIZE - 8, SIZE):
            reserved[i][j] = True
    for i in range(SIZE - 8, SIZE):
        for j in range(9):
            reserved[i][j] = True
    for i in range(SIZE):
        reserved[6][i] = True
        reserved[i][6] = True
    for r in ALIGN_POS:
        for c in ALIGN_POS:
            if (r == 6 and c == 6) or (r == 6 and c == SIZE - 7) or (r == SIZE - 7 and c == 6):
                continue
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    reserved[r + dr][c + dc] = True
    return reserved


def mask_hit(k, r, c):
    return [ (r + c) % 2 == 0,
             r % 2 == 0,
             c % 3 == 0,
             (r + c) % 3 == 0,
             (r // 2 + c // 3) % 2 == 0,
             (r * c) % 2 + (r * c) % 3 == 0,
             ((r * c) % 2 + (r * c) % 3) % 2 == 0,
             ((r + c) % 2 + (r * c) % 3) % 2 == 0 ][k]


def place_data(m, reserved, codewords, mask):
    bits = []
    for cw in codewords:
        for i in range(7, -1, -1):
            bits.append((cw >> i) & 1)
    idx, col, upward = 0, SIZE - 1, True
    while col > 0:
        if col == 6:
            col -= 1
        rng = range(SIZE - 1, -1, -1) if upward else range(SIZE)
        for r in rng:
            for c in (col, col - 1):
                if reserved[r][c]:
                    continue
                bit = bits[idx] if idx < len(bits) else 0
                idx += 1
                if mask_hit(mask, r, c):
                    bit ^= 1
                m[r][c] = bit
        upward = not upward
        col -= 2
    return idx


def draw_format(m, mask):
    data = (ECL_BITS << 3) | mask
    rem = data
    for _ in range(10):
        rem = (rem << 1) ^ ((rem >> 9) * 0x537)
    bits = (data << 10 | rem) ^ 0x5412
    def bit(i):
        return (bits >> i) & 1
    for i in range(6):
        m[i][8] = bit(i)
    m[7][8] = bit(6)
    m[8][8] = bit(7)
    m[8][7] = bit(8)
    for i in range(9, 15):
        m[8][14 - i] = bit(i)
    for i in range(8):
        m[8][SIZE - 1 - i] = bit(i)
    for i in range(8, 15):
        m[SIZE - 15 + i][8] = bit(i)
    m[SIZE - 8][8] = 1


def penalty(mat):
    p = 0
    for rows in (mat, [list(col) for col in zip(*mat)]):
        for row in rows:
            run, prev = 1, row[0]
            for v in row[1:]:
                if v == prev:
                    run += 1
                else:
                    if run >= 5:
                        p += 3 + (run - 5)
                    run, prev = 1, v
            if run >= 5:
                p += 3 + (run - 5)
    for r in range(SIZE - 1):
        for c in range(SIZE - 1):
            v = mat[r][c]
            if v == mat[r][c + 1] == mat[r + 1][c] == mat[r + 1][c + 1]:
                p += 3
    dark = sum(sum(r) for r in mat)
    total = SIZE * SIZE
    k = abs(dark * 20 - total * 10) // total
    p += k * 10
    return p


def encode(text, force_mask=None):
    payload = text.encode('utf-8')
    assert len(payload) <= MAX_BYTES, f'内容 {len(payload)} 字节，超过版本 6-M 上限 {MAX_BYTES}'
    codewords = add_ecc(build_data_codewords(payload))
    best = None
    for mask in range(8) if force_mask is None else [force_mask]:
        m = make_matrix()
        reserved = place_function(m)
        place_data(m, reserved, codewords, mask)
        draw_format(m, mask)
        score = penalty(m)
        if best is None or score < best[0]:
            best = (score, mask, [row[:] for row in m])
    return best[1], best[2]


# ---------------- PNG ----------------
def write_png(path, mat, canvas=512, quiet=4):
    n = len(mat)
    scale = canvas // (n + quiet * 2)
    assert scale >= 1, '画布太小'
    off = (canvas - n * scale) // 2
    rows = []
    for y in range(canvas):
        line = bytearray(b'\x00')
        gy = (y - off) // scale if off <= y < off + n * scale else -1
        for x in range(canvas):
            gx = (x - off) // scale if off <= x < off + n * scale else -1
            dark = 0 <= gy < n and 0 <= gx < n and mat[gy][gx] == 1
            if 0 <= y < off or y >= off + n * scale:
                dark = False
            line += b'\x00\x00\x00' if dark else b'\xff\xff\xff'
        rows.append(bytes(line))
    raw = b''.join(rows)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', canvas, canvas, 8, 2, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    open(path, 'wb').write(png)
    return scale, off


def selftest_url(miniapp_id, version_id):
    return (f'https://www.taptap.cn/qrcode/miniapp?id={miniapp_id}'
            f'&type=develop&version_id={version_id}')


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        return 1
    force = None
    if a[0] == '--selftest':
        text, out = selftest_url(a[1], a[2]), a[3]
        if len(a) > 4:
            force = int(a[4])
    else:
        text, out = a[0], a[1]
    mask, mat = encode(text, force)
    scale, off = write_png(out, mat)
    print(f'  内容：{text}')
    print(f'  版本 6 / 纠错 M / 掩码 {mask} / 模块 {scale}px / 偏移 {off}px')
    print(f'  写出：{out}  ({len(open(out, "rb").read()):,} B)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
