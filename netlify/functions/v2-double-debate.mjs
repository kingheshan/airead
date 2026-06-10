import { getOpenAIClient } from './openai-helper.mjs';

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

  const { author1, author2, query, bookTitle } = body;
  if (!author1 || !author2 || !query) {
    return json(400, { error: 'Missing required parameters: author1, author2, and query.' });
  }

  const client = getOpenAIClient();

  const systemInstructions = `你是一个顶级商业思想辩论模拟器。
你的任务是模拟两位商业领袖/原著作者，针对用户提出的“商业困境或痛点”，展开一场针锋相对的学术辩论，并在辩论结束时给出一份融合双方智慧的“业务共识行动指南”。

模拟辩论的作者是：
作者 A: ${author1}
作者 B: ${author2}

辩论的主题与问题：
"${query}"
(关联书籍背景: ${bookTitle || '未指定'})

要求：
1. 语气真实：高度还原两位作者各自的方法论特色（例如彼得·蒂尔的非共识垄断思维、雷军的效率与参与感思维、克里斯坦森的颠覆式创新逻辑、张小龙的产品克制哲学）。
2. 论点锋利：不能流于客套。作者 A 先陈述策略；作者 B 挑出其理论漏洞并结合用户背景给予质疑；作者 A 进行回击与防御；作者 B 进一步深入质询。
3. 结构严整：
   - 轮次 1：[${author1}] 陈述方案
   - 轮次 2：[${author2}] 猛烈质疑与挑战
   - 轮次 3：[${author1}] 防御与补充逻辑
   - 轮次 4：[${author2}] 终期对垒总结
   - 最终共识：[首席战略官总结] 针对用户痛点，结合双方观点提炼出的“落地行动指南”。
4. 输出格式使用简洁的 Markdown。`;

  try {
    const model = getModel();
    const isReasoning = model.includes('5.5') || model.startsWith('o1') || model.startsWith('o3');
    console.log(`[V2] Calling double-debate with model ${model}...`);
    const response = await client.responses.create({
      model: model,
      instructions: systemInstructions,
      input: `请开始辩论：“${query}”`,
      max_output_tokens: Number(process.env.MAX_OUTPUT_TOKENS || 16384),
      ...(isReasoning && process.env.OPENAI_REASONING_EFFORT ? { reasoning: { effort: process.env.OPENAI_REASONING_EFFORT } } : {})
    });

    return json(200, {
      debate: response.output_text || '',
      model: getModel()
    });
  } catch (error) {
    console.error('[V2] double-debate error:', error);
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
