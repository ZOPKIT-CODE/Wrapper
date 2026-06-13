import fs from 'fs';
const file = process.argv[2];
let c = fs.readFileSync(file, 'utf8');
c = c.replace(/\s+(?:dark|monochrome):(?:[^\s"'`,)]+|\[[^\]]+\])+/g, '');
fs.writeFileSync(file, c);
console.log('stripped', file);
