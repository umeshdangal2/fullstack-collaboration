const fs = require('fs');
const s = fs.readFileSync('public/site-content.js', 'utf8');
const stack = [];
const pairs = { ')': '(', '}': '{', ']': '[' };
const quotes = [];
let escaped = false;
for (let i = 0; i < s.length; i++) {
  const c = s[i];
  if (c === '\\' && !escaped) {
    escaped = true;
    continue;
  }
  if ((c === '"' || c === "'" || c === '`') && !escaped) {
    const top = quotes[quotes.length - 1];
    if (top === c) {
      quotes.pop();
    } else if (!top) {
      quotes.push(c);
    }
  }
  if (quotes.length) {
    escaped = false;
    continue;
  }
  if (c === '(' || c === '[' || c === '{') stack.push(c);
  if (c === ')' || c === ']' || c === '}') {
    const top = stack.pop();
    if (top !== pairs[c]) {
      console.log('mismatch', c, 'at', i, 'top', top);
      break;
    }
  }
  escaped = false;
}
console.log('stack len', stack.length, 'top', stack[stack.length - 1]);
console.log('quotes len', quotes.length, 'top', quotes[quotes.length - 1]);
console.log('line count', s.split(/\r?\n/).length);
