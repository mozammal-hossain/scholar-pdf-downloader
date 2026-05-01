#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Minimal 1x1 blue PNG (base64)
const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mM8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

[16, 48, 128].forEach((size) => {
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, minimalPng);
  console.log(`Created ${filename}`);
});

console.log('Icons created (placeholder).');
