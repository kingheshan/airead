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
      error: 'OPENAI_API_KEY is not configured.'
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const { title, author, categoryLabel, goal, cardType } = body;
  if (!title) {
    return json(400, { error: '缺少书籍标题 title。' });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Custom visual prompts based on the requested card type
  let typePrompt = '';
  let filenameLabel = 'concept_card';
  if (cardType === 'strategy_card') {
    typePrompt = `A premium executive strategy card and logic flow mindmap. Dark theme with vibrant neon cyan and light green highlights. Flat vector graphics of interconnected gears, brain nodes, and logical pointers representing business competitive moat, monopoly positioning, and startup leverage.`;
    filenameLabel = 'strategy_card';
  } else if (cardType === 'execution_poster') {
    typePrompt = `A clean, professional 12-month business execution timeline and roadmap dashboard. Ultra-modern vector illustration, dark theme with glowing neon purple and blue accent lines. Showing nodes of milestone goals, checklists, sprint charts, and structural flow charts.`;
    filenameLabel = 'execution_poster';
  } else if (cardType === 'team_mindmap') {
    typePrompt = `A stunning conceptual team co-learning mind map and cognitive system. Dark theme, vibrant neon green and yellow accents. Showing network clusters, training cards, speech bubble icons, and collaborative pathways. Minimalist, clean composition.`;
    filenameLabel = 'team_mindmap';
  } else {
    typePrompt = `A professional, premium conceptual infographic card for the book. Dark theme with neon accent lines. Show structural flowcharts and cognitive mapping. Minimal text, clean layout.`;
  }

  const prompt = `${typePrompt} Book Title: "${title}" by "${author || 'Unknown Author'}". Category: ${categoryLabel || 'Strategy'}. Reading Goal: ${goal || 'General study'}. Clean high-end presentation style, no messy gibberish words, 4k resolution, clean composition.`;

  try {
    console.log(`[V2] Generating infographic for cardType ${cardType || 'default'} using gpt-image-2...`);
    const response = await client.images.generate({
      model: 'gpt-image-2',
      prompt: prompt,
      n: 1,
      size: '1024x1024'
    });

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
      prompt,
      model: 'gpt-image-2',
      cardType: cardType || 'default',
      filename: `小鹿AI拆书-V2-${filenameLabel}-${title}.png`
    });
  } catch (error) {
    console.error('[V2] generate-infographic error:', error);
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
