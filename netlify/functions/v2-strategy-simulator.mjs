import OpenAI from 'openai';

const getModel = () => {
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  if (model.includes('5.5') || model.startsWith('o1') || model.startsWith('o3')) {
    return 'gpt-4o';
  }
  return model;
};

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

  const { title, scenario, goal, budget, teamSize } = body;
  if (!title || !scenario) {
    return json(400, { error: 'Missing required parameters: title and scenario.' });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemInstructions = `你是一个高精度的商业战略沙盘模拟算法引擎。
你的任务是根据用户选择的书籍思想、当前面临的商业场景假设、团队和预算约束，模拟在未来12个月内该战略实施的推演轨迹。

你必须依据该书籍的核心因果律规则：
书籍: "${title}"
战略动作假设: "${scenario}"
当前背景约束: 预算约 ${budget || '未指定'} 元，团队规模 ${teamSize || '未指定'} 人，战略目标: "${goal || '推进业务验证'}"

请计算并输出以下结构化 JSON（仅输出合法的 JSON 格式代码块，不要包含任何前言或解释文字，直接以 \`{\` 开始，以 \`}\` 结束）：

{
  "successProbability": 78, // 胜率百分比 (0-100)
  "rulesApplied": [
    "规则名1: 规则描述（如《从0到1》的小市场垄断定律：在极细分市场建立10倍体验垄断）"
  ],
  "timelineProjections": [
    { "month": "M1", "users": 100, "revenue": 10000, "confidence": 95 },
    { "month": "M2", "users": 150, "revenue": 15000, "confidence": 90 },
    { "month": "M3", "users": 230, "revenue": 23000, "confidence": 85 },
    { "month": "M4", "users": 400, "revenue": 40000, "confidence": 80 },
    { "month": "M5", "users": 700, "revenue": 70000, "confidence": 75 },
    { "month": "M6", "users": 1200, "revenue": 120000, "confidence": 70 },
    { "month": "M7", "users": 2000, "revenue": 200000, "confidence": 65 },
    { "month": "M8", "users": 3200, "revenue": 320000, "confidence": 60 },
    { "month": "M9", "users": 4800, "revenue": 480000, "confidence": 55 },
    { "month": "M10", "users": 6800, "revenue": 680000, "confidence": 50 },
    { "month": "M11", "users": 9500, "revenue": 950000, "confidence": 45 },
    { "month": "M12", "users": 13000, "revenue": 1300000, "confidence": 40 }
  ],
  "criticalFailurePoints": [
    { "point": "瓶颈或死穴描述（如：用户替换成本过高导致的初始推广滞销）", "severity": "高/中/低", "triggerCondition": "触发临界条件描述" }
  ],
  "strategicAdjustments": [
    "如果触发死穴，应如何根据原著理念调整业务模型（如：逆向实施免费工具引流）"
  ]
}`;

  try {
    const model = getModel();
    const isReasoning = model.includes('5.5') || model.startsWith('o1') || model.startsWith('o3');
    console.log(`[V2] Calling strategy-simulator with model ${model}...`);
    const response = await client.responses.create({
      model: model,
      instructions: systemInstructions,
      input: `请开始推演战略动作：${scenario}`,
      max_output_tokens: Number(process.env.MAX_OUTPUT_TOKENS || 16384),
      ...(isReasoning && process.env.OPENAI_REASONING_EFFORT ? { reasoning: { effort: process.env.OPENAI_REASONING_EFFORT } } : {})
    });

    let jsonStr = response.output_text || '{}';
    // Clean potential markdown wrap
    jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```$/, '').trim();

    let parsedData = {};
    try {
      parsedData = JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse simulator output JSON:', jsonStr);
      // Fallback fallback data structure
      parsedData = {
        successProbability: 50,
        rulesApplied: ['Error parsing rules'],
        timelineProjections: [],
        criticalFailurePoints: [{ point: 'JSON parse error', severity: 'High', triggerCondition: 'API return malformed' }],
        strategicAdjustments: ['Check raw logs']
      };
    }

    return json(200, {
      ...parsedData,
      rawOutput: response.output_text,
      model: getModel()
    });
  } catch (error) {
    console.error('[V2] strategy-simulator error:', error);
    return json(502, { error: error.message });
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
