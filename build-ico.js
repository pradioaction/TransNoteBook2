const sharp = require('sharp');
const fs = require('fs');

async function main() {
  const svg = fs.readFileSync('TN.svg', 'utf-8');
  // 标准 Windows ICO 尺寸
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = [];

  for (const size of sizes) {
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    pngs.push({ size, data: buf });
  }

  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);   // ICO type
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const entries = [];
  const images = [];

  for (const { size, data } of pngs) {
    const w = size >= 256 ? 0 : size;
    const h = size >= 256 ? 0 : size;
    const e = Buffer.alloc(16);
    e.writeUInt8(w, 0);
    e.writeUInt8(h, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
    images.push(data);
  }

  const ico = Buffer.concat([header, ...entries, ...images]);
  fs.writeFileSync('TN.ico', ico);
  console.log('ICO: ' + ico.length + ' bytes, ' + count + ' sizes');
}

main().catch(e => { console.error(e); process.exit(1); });
