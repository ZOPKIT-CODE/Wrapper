import fs from 'node:fs';
import path from 'node:path';

const apis = ['createContext', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'memo', 'forwardRef', 'Component'];
const root = path.join(process.cwd(), 'src');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && !['node_modules', 'dist', '__tests__'].includes(ent.name)) walk(p, out);
    else if (ent.isFile() && /\.tsx?$/.test(ent.name) && !/\.test\.(tsx?)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const bad = [];
for (const file of walk(root)) {
  const s = fs.readFileSync(file, 'utf8');
  if (!apis.some((a) => new RegExp(`\\b${a}\\b`).test(s))) continue;
  if (!/from ['"]react['"]/.test(s)) bad.push(path.relative(process.cwd(), file).replace(/\\/g, '/'));
}

console.log(bad.length ? bad.join('\n') : 'none');
