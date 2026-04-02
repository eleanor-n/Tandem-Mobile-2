const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const size = 1024;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');
const cx = size / 2;
const cy = size / 2;

// Rounded rectangle background
ctx.fillStyle = '#5BC8E8';
const r = 230;
ctx.beginPath();
ctx.moveTo(r, 0);
ctx.lineTo(size - r, 0);
ctx.quadraticCurveTo(size, 0, size, r);
ctx.lineTo(size, size - r);
ctx.quadraticCurveTo(size, size, size - r, size);
ctx.lineTo(r, size);
ctx.quadraticCurveTo(0, size, 0, size - r);
ctx.lineTo(0, r);
ctx.quadraticCurveTo(0, 0, r, 0);
ctx.closePath();
ctx.fill();

// Draw one triangular ray rotated 8 times
const innerR = 123; // base touches circle edge
const outerR = 320; // tip of ray
const halfBase = 28; // half-width of base

function drawRay(angleDeg) {
  const angle = (angleDeg * Math.PI) / 180;
  const perpAngle = angle + Math.PI / 2;

  const tipX = cx + Math.cos(angle) * outerR;
  const tipY = cy + Math.sin(angle) * outerR;

  const base1X = cx + Math.cos(angle) * innerR + Math.cos(perpAngle) * halfBase;
  const base1Y = cy + Math.sin(angle) * innerR + Math.sin(perpAngle) * halfBase;

  const base2X = cx + Math.cos(angle) * innerR - Math.cos(perpAngle) * halfBase;
  const base2Y = cy + Math.sin(angle) * innerR - Math.sin(perpAngle) * halfBase;

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(base1X, base1Y);
  ctx.lineTo(base2X, base2Y);
  ctx.closePath();
  ctx.fill();
}

ctx.fillStyle = 'white';

// 8 rays evenly spaced — all identical size
for (let i = 0; i < 8; i++) {
  drawRay(i * 45 - 90);
}

// Sun circle on top
ctx.beginPath();
ctx.arc(cx, cy, 120, 0, Math.PI * 2);
ctx.fill();

// Save to assets
const buffer = canvas.toBuffer('image/png');
const assetsDir = path.join(__dirname, '..', 'assets');
fs.writeFileSync(path.join(assetsDir, 'icon.png'), buffer);
fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), buffer);
console.log('Done — icon.png and splash-icon.png written to assets/');
