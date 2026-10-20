'use strict';
/*
 * 手写 ZIP：根目录恰好一个游戏目录，entry 名用 "/"，避免 Windows 反斜杠问题。
 * 用法: node tools/mk_taptap_zip.cjs <源index.html> <zip输出路径> <根目录名>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const [, , srcFile, outFile, rootDir] = process.argv;
if (!srcFile || !outFile || !rootDir) {
  console.error('用法: node mk_taptap_zip.cjs <index.html> <out.zip> <rootDir>');
  process.exit(2);
}
if (!fs.existsSync(srcFile)) { console.error('源文件不存在: ' + srcFile); process.exit(2); }
if (/[\\/]/.test(rootDir)) { console.error('根目录名不得含分隔符'); process.exit(2); }

// CRC32
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const data = fs.readFileSync(srcFile);
const entryName = rootDir + '/index.html';
const nameBuf = Buffer.from(entryName, 'utf8');
const compressed = zlib.deflateRawSync(data, { level: 9 });
const crc = crc32(data);

const now = new Date();
const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

// local file header
const lfh = Buffer.alloc(30);
lfh.writeUInt32LE(0x04034b50, 0);
lfh.writeUInt16LE(20, 4);          // version needed
lfh.writeUInt16LE(0x0800, 6);      // flags: UTF-8 name
lfh.writeUInt16LE(8, 8);           // method deflate
lfh.writeUInt16LE(dosTime, 10);
lfh.writeUInt16LE(dosDate, 12);
lfh.writeUInt32LE(crc, 14);
lfh.writeUInt32LE(compressed.length, 18);
lfh.writeUInt32LE(data.length, 22);
lfh.writeUInt16LE(nameBuf.length, 26);
lfh.writeUInt16LE(0, 28);

const localPart = Buffer.concat([lfh, nameBuf, compressed]);

// central directory
const cdh = Buffer.alloc(46);
cdh.writeUInt32LE(0x02014b50, 0);
cdh.writeUInt16LE(20, 4);
cdh.writeUInt16LE(20, 6);
cdh.writeUInt16LE(0x0800, 8);
cdh.writeUInt16LE(8, 10);
cdh.writeUInt16LE(dosTime, 12);
cdh.writeUInt16LE(dosDate, 14);
cdh.writeUInt32LE(crc, 16);
cdh.writeUInt32LE(compressed.length, 20);
cdh.writeUInt32LE(data.length, 24);
cdh.writeUInt16LE(nameBuf.length, 28);
cdh.writeUInt16LE(0, 30);
cdh.writeUInt16LE(0, 32);
cdh.writeUInt16LE(0, 34);
cdh.writeUInt16LE(0, 36);
cdh.writeUInt32LE(0, 38);
cdh.writeUInt32LE(0, 42);
const centralPart = Buffer.concat([cdh, nameBuf]);

// EOCD
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(1, 8);
eocd.writeUInt16LE(1, 10);
eocd.writeUInt32LE(centralPart.length, 12);
eocd.writeUInt32LE(localPart.length, 16);
eocd.writeUInt16LE(0, 20);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, Buffer.concat([localPart, centralPart, eocd]));

// 回读校验
const back = fs.readFileSync(outFile);
const nameLen = back.readUInt16LE(26);
const gotName = back.slice(30, 30 + nameLen).toString('utf8');
const compSize = back.readUInt32LE(18);
const gotData = zlib.inflateRawSync(back.slice(30 + nameLen, 30 + nameLen + compSize));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').toUpperCase();

console.log('ZIP 已生成: ' + outFile);
console.log('  zip 大小   : ' + back.length.toLocaleString() + ' B');
console.log('  entry 名   : ' + gotName);
console.log('  entry 数   : 1（根目录 ' + rootDir + '）');
console.log('  源 sha256  : ' + sha(data));
console.log('  回读 sha256: ' + sha(gotData));
console.log('  校验       : ' + (sha(data) === sha(gotData) ? 'PASS 一致' : 'FAIL 不一致'));
if (sha(data) !== sha(gotData)) process.exit(1);
