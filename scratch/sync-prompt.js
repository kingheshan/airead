import fs from 'fs';
import path from 'path';

const mdPath = path.resolve('AIRead提示词.md');
const mjsPath = path.resolve('netlify/functions/prompt-text.mjs');

try {
  const content = fs.readFileSync(mdPath, 'utf8');
  // Escape backticks, backslashes, and template literals
  const escaped = content
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');
  
  const output = `// Auto-generated from AIRead提示词.md. Do not edit directly.\nexport const promptText = \`${escaped}\`;\n`;
  fs.writeFileSync(mjsPath, output, 'utf8');
  console.log('Successfully synced prompt-text.mjs');
} catch (e) {
  console.error('Failed to sync prompt:', e);
  process.exit(1);
}
