import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../src');

const SKIP = new Set([
  'index.css',
]);

function strip(content) {
  return content.replace(/\s+(?:dark|monochrome):(?:[^\s"'`,)]+|\[[^\]]+\])+/g, '');
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (SKIP.has(rel)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = strip(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
    console.log(rel);
  }
}
console.log('Files changed:', changed);
