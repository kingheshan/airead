import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    console.log("Generating image with model gpt-image-2...");
    const response = await client.images.generate({
      model: 'gpt-image-2',
      prompt: 'A premium conceptual map for the book "From 0 to 1". Flat vector illustration, dark theme, neon colors.',
      n: 1,
      size: '1024x1024'
    });
    console.log("Success! Full Response:", JSON.stringify(response, null, 2));
  } catch (error) {
    console.error("Error generating image:", error);
  }
}

test();
