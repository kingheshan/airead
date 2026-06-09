import OpenAI from 'openai';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

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
    return json(500, { error: 'OPENAI_API_KEY is not configured.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const { title, author, goal, report } = body;
  if (!title || !report) {
    return json(400, { error: '缺少书籍标题 title 或报告内容 report。' });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // 1. Generate the spoken briefing script
    const systemPrompt = `You are a professional business radio host and senior strategist. 
Your job is to read a book report and produce a spoken-style Chinese briefing (商业简报) tailored to the user's business scenario.
Create a natural, engaging, and professional monologue script in Chinese.
- Focus on the core business challenge, the book's main competitive strategy model, and 1-2 actionable MVP testing steps.
- Explain the key warnings or boundaries.
- Keep the tone inspiring, strategic, and concise.
- Output ONLY a single paragraph of fluid spoken Chinese text (around 350-450 characters).
- DO NOT use markdown formatting, bullet points, asterisks, headers, or speaker tags (like "主持人:", "播音员:"). It should be purely readable spoken prose.`;

    const userPrompt = `书籍：《${title}》${author ? ` 作者：${author}` : ''}
用户的具体业务目标/场景：${goal || '未提供，进行通用战略推演'}
报告概要：
${report.slice(0, 4000)}

请为用户的目标定制录制文稿：`;

    console.log(`[V2] Generating podcast briefing script using model ${MODEL}...`);
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 800
    });

    const scriptText = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!scriptText) {
      throw new Error('Failed to generate briefing script.');
    }

    console.log(`[V2] Generating TTS audio using model tts-1 with voice onyx...`);
    const ttsResponse = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx', // deep professional voice
      input: scriptText
    });

    const buffer = Buffer.from(await ttsResponse.arrayBuffer());
    const base64Audio = buffer.toString('base64');
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

    return json(200, {
      audioUrl,
      script: scriptText,
      title
    });

  } catch (error) {
    console.error('[V2] generate-podcast error:', error);
    return json(502, {
      error: `简报电台生成失败: ${error.message}`
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
