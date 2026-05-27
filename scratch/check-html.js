import fs from 'fs';
import vm from 'vm';

const htmlContent = fs.readFileSync('v2/index.html', 'utf8');

// Find all script blocks
const regex = /<script>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;

while ((match = regex.exec(htmlContent)) !== null) {
  count++;
  const jsContent = match[1];
  try {
    new vm.Script(jsContent);
    console.log(`Script block ${count} is valid.`);
  } catch (err) {
    console.error(`Syntax error in script block ${count}:`, err.message);
    
    // Print lines around error
    const lines = jsContent.split('\n');
    const errLineMatch = err.stack.match(/evalmachine\.<anonymous>:(\d+)/);
    if (errLineMatch) {
      const errLine = parseInt(errLineMatch[1], 10);
      const start = Math.max(0, errLine - 5);
      const end = Math.min(lines.length - 1, errLine + 5);
      console.error('Context:');
      for (let i = start; i <= end; i++) {
        console.error(`${i + 1}: ${lines[i]}`);
      }
    }
    process.exit(1);
  }
}

if (count === 0) {
  console.error('No script blocks found in v2/index.html!');
  process.exit(1);
} else {
  console.log(`Successfully verified ${count} script blocks in v2/index.html.`);
}
