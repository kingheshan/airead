import OpenAI from 'openai';

const apiKey = 'REDACTED_API_KEY';
const client = new OpenAI({ apiKey });

try {
  console.log('Testing responses.create with gpt-4o-mini and reasoning effort low...');
  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    instructions: 'You are a helpful assistant.',
    input: 'Hello! Please return a 2-word greeting.',
    reasoning: { effort: 'low' }
  });
  console.log('Success! Response:', response.output_text);
} catch (error) {
  console.error('Failed with error:', error);
}
