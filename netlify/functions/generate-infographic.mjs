import OpenAI from 'openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(500, {
      error: 'OPENAI_API_KEY is not configured. 请在部署环境中设置 OPENAI_API_KEY。'
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const { title, author, categoryLabel, goal } = body;
  if (!title) {
    return json(400, { error: '缺少书籍标题 title。' });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Visual prompt engineering for clean, modern conceptual infographics
  const prompt = `A professional, premium conceptual infographic card and mind map for the book "${title}" by "${author || 'Unknown Author'}". 
Category: ${categoryLabel || 'Strategy / Management'}. 
Reading Goal: ${goal || 'General study'}.
The design must be an ultra-modern flat vector illustration of knowledge structures, a tech dashboard, dark theme with vibrant neon cyan, blue, and light green accent lines. Show structural flowcharts, gears, and abstract conceptual nodes representing business models, strategic thinking, and cognitive mapping. The image should look like a clean high-end presentation slide or educational infographic. Minimal text, no messy gibberish words, focused on premium visual design and clean structured layout. 4k resolution, clean composition.`;

  try {
    // Generate image using AI Image Generator (gpt-image-2)
    console.log("Calling client.images.generate with model: gpt-image-2");
    const response = await client.images.generate({
      model: 'gpt-image-2',
      prompt: prompt, // gpt-image-2 supports longer prompts
      n: 1,
      size: '1024x1024'
    });

    console.log("OpenAI API raw data keys returned:", response.data?.[0] ? Object.keys(response.data[0]) : "none");

    const dataObj = response.data?.[0];
    let imageUrl = dataObj?.url;
    if (!imageUrl && dataObj?.b64_json) {
      imageUrl = `data:image/png;base64,${dataObj.b64_json}`;
    }

    if (!imageUrl) {
      throw new Error('No image URL or base64 data returned from AI Image Generator.');
    }

    return json(200, {
      imageUrl,
      prompt: prompt,
      model: 'gpt-image-2'
    });
  } catch (error) {
    console.error("Error in generate-infographic:", error);
    return json(502, {
      error: `AI 概念图生成失败: ${error.message}`
    });
  }
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  };
}
