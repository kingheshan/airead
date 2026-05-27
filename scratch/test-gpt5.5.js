import OpenAI from 'openai';
import fs from 'fs';

const envPath = '/Users/king/Desktop/xiaoluAIRead/.env';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  });
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || 'gpt-5.5';
console.log('Testing with model:', model);

async function run() {
  if (client.responses) {
    try {
      console.log('Attempting client.responses.create with reasoning effort low...');
      const start = Date.now();
      const response = await client.responses.create({
        model: model,
        instructions: 'You are a helpful assistant.',
        input: 'Say hello in 3 words.',
        reasoning: { effort: 'low' }
      });
      console.log(`Success! Time: ${Date.now() - start}ms`);
      console.log('Response:', JSON.stringify(response, null, 2));
      return;
    } catch (err) {
      console.error('responses.create failed:', err.message);
    }
  } else {
    console.log('client.responses is undefined');
  }

  try {
    console.log('Attempting client.chat.completions.create as fallback...');
    const start = Date.now();
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: 'Say hello in 3 words.' }]
    });
    console.log(`Success! Time: ${Date.now() - start}ms`);
    console.log('Response:', response.choices[0]?.message?.content);
  } catch (err) {
    console.error('chat.completions.create failed:', err.message);
  }
}

run();
