import fs from 'fs';
import path from 'path';

const files = [
  'generate-infographic.mjs',
  'generate-report.mjs',
  'v2-distill-skill.mjs',
  'v2-double-debate.mjs',
  'v2-generate-infographic.mjs',
  'v2-generate-podcast.mjs',
  'v2-generate-report.mjs',
  'v2-roundtable-chat.mjs',
  'v2-strategy-simulator.mjs'
];

const dir = 'netlify/functions';

for (const file of files) {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Replace import
  content = content.replace(
    /import OpenAI from ['"]openai['"];/g,
    "import { getOpenAIClient } from './openai-helper.mjs';"
  );

  // Replace client instantiation
  content = content.replace(
    /new OpenAI\(\{\s*apiKey:\s*process\.env\.OPENAI_API_KEY\s*\}\)/g,
    'getOpenAIClient()'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully patched: ${filePath}`);
}
