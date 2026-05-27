import fs from 'fs';
import readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('/Users/king/.gemini/antigravity/brain/77f8e19e-1b3a-46ac-acb0-07fa29adde52/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const idx = line.indexOf('这次升级的核心能力');
    if (idx !== -1) {
      console.log(`Found match in line of length ${line.length}:`);
      const start = Math.max(0, idx - 500);
      const end = Math.min(line.length, idx + 1500);
      console.log(line.substring(start, end).replace(/\\n/g, '\n').replace(/\\"/g, '"'));
      console.log('\n=======================================\n');
    }
  }
}

main();
