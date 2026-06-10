import OpenAI from 'openai';

const apiKey = 'REDACTED_API_KEY';
const client = new OpenAI({ apiKey });

try {
  console.log('Testing OpenAI key by listing models...');
  const models = await client.models.list();
  console.log('Success! Key is valid. Models list count:', models.data.length);
} catch (error) {
  console.error('Error testing key:', error);
}
