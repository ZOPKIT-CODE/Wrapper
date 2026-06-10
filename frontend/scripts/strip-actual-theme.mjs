import fs from 'fs';

const file = process.argv[2];
let c = fs.readFileSync(file, 'utf8');

// Triple ternary with double quotes -> keep light branch
c = c.replace(
  /actualTheme === 'dark' \? "[^"]*" : actualTheme === 'monochrome' \? "[^"]*" : "([^"]*)"/g,
  '"$1"'
);

// Triple ternary with single quotes
c = c.replace(
  /actualTheme === 'dark' \? '[^']*' : actualTheme === 'monochrome' \? '[^']*' : '([^']*)'/g,
  "'$1'"
);

// dark ? X : (monochrome ? Y : Z)
c = c.replace(
  /actualTheme === 'dark'\s*\?[^:]+\s*:\s*\(actualTheme === 'monochrome' \? '[^']*' : '([^']*)'\)/g,
  "'$1'"
);

// dark && 'class' -> remove
c = c.replace(/\s*actualTheme === 'dark' && '[^']*'/g, '');
c = c.replace(/\s*actualTheme === 'monochrome' && '[^']*'/g, '');

// (actualTheme !== 'dark' && actualTheme !== 'monochrome') ? X : undefined -> X
c = c.replace(
  /\(actualTheme !== 'dark' && actualTheme !== 'monochrome'\) \? (\{[^}]+\}) : undefined/g,
  '$1'
);

// Template literal triple ternaries - collapse to light text class
c = c.replace(
  /\$\{actualTheme === 'dark'\s*\? '[^']*' : actualTheme === 'monochrome' \? '[^']*' : '([^']*)'\}/g,
  '$1'
);

// Remaining dark ? ... : monochrome ? ... :  (multiline in className templates)
c = c.replace(
  /\$\{actualTheme === 'dark'[\s\S]*?: actualTheme === 'monochrome'[\s\S]*?: '([^']*)'\}/g,
  '$1'
);

// Simple two-branch dark : light in template - keep second branch after last :
// actualTheme === 'dark' ? 'a' : 'b' inside ${}
c = c.replace(/\$\{actualTheme === 'dark' \? '[^']*' : '([^']*)'\}/g, '$1');

fs.writeFileSync(file, c);
console.log('done', file);
