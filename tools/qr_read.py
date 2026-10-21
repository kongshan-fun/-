#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""最小 QR 解码器（只处理无畸变、无噪点的合成图：PNG 8bit RGB/RGBA、非隔行）。
用途：读出仓库里历史自测二维码到底编码了什么，以便复现同一口径。零第三方依赖。

用法: python tools/qr_read.py <png>
"""
import sys
import zlib
import struct

ALPHANUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'


def load_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', '不是 PNG'
    pos, idat, w, h, bpp = 8, b'', None, None, None
    while pos < len(data):
        (length,) = struct.unpack('>I', data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if ctype == b'IHDR':
            w, h, depth, color, comp, filt, inter = struct.unpack('>IIBBBBB', chunk)
            assert depth == 8 and inter == 0, '只支持 8bit 非隔行'
            assert color in (2, 6), '只支持 RGB/RGBA'
            bpp = 3 if color == 2 else 4
        elif ctype == b'IDAT':
            idat += chunk
        elif ctype == b'IEND':
            break
    raw = zlib.decompress(idat)
    stride = w * bpp
    rows, prev, p = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        if f == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 0xFF
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif f == 3:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif f == 4:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        rows.append(bytes(line))
        prev = line
    return w, h, bpp, rows


def to_matrix(path):
    w, h, bpp, rows = load_png(path)
    def px(x, y):
        return rows[y][x * bpp] < 128
    xs = [x for x in range(w) if any(px(x, y) for y in range(h))]
    ys = [y for y in range(h) if any(px(x, y) for x in range(w))]
    x0, x1, y0 = min(xs), max(xs), min(ys)
    run = 0
    while x0 + run <= x1 and px(x0 + run, y0):
        run += 1
    m = run / 7.0
    n = int(round((x1 - x0 + 1) / m))
    assert (n - 17) % 4 == 0 and 21 <= n <= 177, f'模块数异常 {n} (module={m})'
    ver = (n - 17) // 4
    mat = [[1 if px(int(x0 + (c + 0.5) * m), int(y0 + (r + 0.5) * m)) else 0
            for c in range(n)] for r in range(n)]
    return ver, n, mat


ALIGN = {1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
         7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]}

# 版本 6 的分块结构：EC 等级 -> (块数, 每块数据码字数)。数据码字是块间交错存放的。
BLOCKS6 = {'L': (2, 68), 'M': (4, 27), 'Q': (4, 19), 'H': (4, 15)}


def deinterleave(bytes_in, level):
    nb, per = BLOCKS6[level]
    out = bytearray()
    for b in range(nb):
        for i in range(per):
            idx = i * nb + b
            if idx < len(bytes_in):
                out.append(bytes_in[idx])
    return bytes(out)



def mask_hit(k, r, c):
    return [ (r + c) % 2 == 0,
             r % 2 == 0,
             c % 3 == 0,
             (r + c) % 3 == 0,
             (r // 2 + c // 3) % 2 == 0,
             (r * c) % 2 + (r * c) % 3 == 0,
             ((r * c) % 2 + (r * c) % 3) % 2 == 0,
             ((r + c) % 2 + (r * c) % 3) % 2 == 0 ][k]


def reserved(n, ver):
    R = [[False] * n for _ in range(n)]
    def block(r, c, hh, ww):
        for i in range(hh):
            for j in range(ww):
                if 0 <= r + i < n and 0 <= c + j < n:
                    R[r + i][c + j] = True
    block(0, 0, 9, 9); block(0, n - 8, 9, 8); block(n - 8, 0, 8, 9)
    for i in range(n):
        R[6][i] = R[i][6] = True
    if ver >= 2:
        pos = ALIGN.get(ver, [])
        for r in pos:
            for c in pos:
                if (r == 6 and c == 6) or (r == 6 and c == pos[-1]) or (r == pos[-1] and c == 6):
                    continue
                block(r - 2, c - 2, 5, 5)
    if ver >= 7:
        block(n - 11, 0, 3, 6); block(0, n - 11, 6, 3)
    return R


def read_bits(mat, n, ver, mask):
    R = reserved(n, ver)
    bits, col, upward = [], n - 1, True
    while col > 0:
        if col == 6:
            col -= 1
        rng = range(n - 1, -1, -1) if upward else range(n)
        for r in rng:
            for c in (col, col - 1):
                if R[r][c]:
                    continue
                v = mat[r][c] ^ (1 if mask_hit(mask, r, c) else 0)
                bits.append(v)
        upward = not upward
        col -= 2
    return bits


def take(bits, pos, k):
    v = 0
    for i in range(k):
        v = (v << 1) | bits[pos + i]
    return v, pos + k


def decode_segments(bits, ver):
    out, pos = [], 0
    while pos + 4 <= len(bits):
        mode, pos = take(bits, pos, 4)
        if mode == 0:
            break
        if mode == 2:
            cnt, pos = take(bits, pos, 9 if ver <= 9 else 11 if ver <= 26 else 13)
            s = ''
            for _ in range(cnt):
                v, pos = take(bits, pos, 6)
                s += ALPHANUM[v]
            out.append(s)
        elif mode == 4:
            cnt, pos = take(bits, pos, 8 if ver <= 9 else 16)
            raw = bytearray()
            for _ in range(cnt):
                v, pos = take(bits, pos, 8)
                raw.append(v)
            out.append(raw.decode('utf-8', 'replace'))
        elif mode == 1:
            cnt, pos = take(bits, pos, 10 if ver <= 9 else 12 if ver <= 26 else 14)
            grp = [10, 12, 14][0] if ver <= 9 else 0
            s, left = '', cnt
            while left >= 3:
                v, pos = take(bits, pos, 10); s += str(v).zfill(3); left -= 3
            if left == 2:
                v, pos = take(bits, pos, 7); s += str(v).zfill(2)
            elif left == 1:
                v, pos = take(bits, pos, 4); s += str(v)
            out.append(s)
        else:
            return None
    return ''.join(out)


def bits_to_bytes(bits):
    out = bytearray()
    for i in range(0, len(bits) - 7, 8):
        b = 0
        for j in range(8):
            b = (b << 1) | bits[i + j]
        out.append(b)
    return bytes(out)


def main():
    path = sys.argv[1]
    ver, n, mat = to_matrix(path)
    print(f'  {path}\n  版本 {ver} · {n}×{n} 模块')
    for level in 'LMQH':
        nb, per = BLOCKS6[level]
        need = nb * per
        for mask in range(8):
            bits = read_bits(mat, n, ver, mask)
            raw = bits_to_bytes(bits)[:need]
            data = deinterleave(raw, level)
            seq = []
            for b in data:
                seq.extend((b >> (7 - k)) & 1 for k in range(8))
            try:
                text = decode_segments(seq, ver)
            except Exception:
                continue
            if not text:
                continue
            printable = sum(1 for ch in text if 31 < ord(ch) < 127 or ord(ch) > 0x2E00)
            if printable / len(text) > 0.95:
                print(f'  EC {level} · 掩码 {mask} · 内容：{text!r}')
                return
    print('  未能解出')


if __name__ == '__main__':
    main()
