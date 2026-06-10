import OpenAI from 'openai';

const apiKey = 'REDACTED_API_KEY';
const client = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://api.deepseek.com/v1'
});

async function run() {
  console.log('Testing DeepSeek API connection...');
  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'user', content: 'Hello! Return a 1-word greeting.' }
      ],
      max_tokens: 10
    });
    console.log('Success! Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('DeepSeek API connection failed:', error);
  }
}

run();
