import { getOpenAIClient, getModel } from './openai-helper.mjs';
const getMaxOutputTokens = () => Number(process.env.MAX_OUTPUT_TOKENS || 16384);

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

  const { title, author, reportMarkdown } = body;
  if (!title || !reportMarkdown) {
    return json(400, { error: '缺少必填参数 title 或 reportMarkdown。' });
  }

  const client = getOpenAIClient();

  const systemInstructions = `你是一个高精度的结构化数据提取引擎。
你的任务是读取一份已经生成的《${title}》（作者：${author || '未知'}）的拆书报告，并从中提取核心要点，格式化并生成用于数据库存储和Anki闪卡渲染的 JSON 数据结构。

请仅输出合法的 JSON 格式代码块，不要包含任何前言或解释文字，直接以 \`{\` 开始，以 \`}\` 结束。
JSON 结构必须严格符合以下定义：
{
  "book_card": {
    "title": "${title}",
    "author": "${author || '未知'}",
    "category": "strategy",
    "one_sentence": "用一句话（50字以内）概括本书的核心逻辑/一句话拆书",
    "root_problem": "本书要解决的根问题",
    "main_thesis": "作者的核心主张/核心逻辑",
    "best_use_case": "最适用的业务场景或用户群体",
    "biggest_risk": "最大的误用风险或反方观点",
    "recommendation_level": "推荐指数（如：五星、四星等）",
    "team_reading_recommendation": "是否推荐团队共读及理由"
  },
  "core_ideas": [
    {
      "idea": "核心观点简述（不超过30字）",
      "logic": "核心观点的底层逻辑或支撑理由",
      "evidence_level": "证据等级（A/B/C/D）",
      "confidence": "可信度（高/中/低）",
      "relevance_to_me": "对读者的战略启发",
      "suggested_action": "建议采取的行动"
    }
  ],
  "models": [
    {
      "name": "提炼出的商业模型/概念/框架名称",
      "explanation": "对该模型的核心步骤、机理或公式的详细解释",
      "steps": [
        "模型执行/使用步骤1",
        "模型执行/使用步骤2"
      ],
      "use_case_for_me": "在读者当前业务场景中的具体应用方式",
      "misuse_risk": "可能被误用或滥用的风险",
      "priority": "优先级（高/中/低）"
    }
  ],
  "assumptions": [
    {
      "assumption": "支撑本书的底层假设/读前假设更新",
      "why_it_matters": "为什么这个假设很重要",
      "valid_conditions": "假设成立的约束条件或边界",
      "risk_if_false": "如果该假设不成立会带来什么业务死穴或风险"
    }
  ]
}

要求：
1. 提取的信息必须严格忠实于输入的拆书报告文本，不能编造报告中没有的内容。
2. "models" 数组应包含 2-3 个最核心的模型/概念框架。
3. "assumptions" 数组应包含 2-3 个最核心的底层或对齐假设。
4. "core_ideas" 数组应包含 3-4 个最核心的论点。
5. 必须输出合法的、可被 JSON.parse 解析的 JSON 数据，不要在 JSON 内使用任何 Markdown 加粗、斜体或换行符，不要包含 \`\`\`json 块，直接返回 JSON 字符串本身。`;

  let response;
  let usedModel = getModel();

  try {
    console.log(`[V2] Extracting report metadata with model ${usedModel}...`);
    response = await client.responses.create({
      model: usedModel,
      instructions: systemInstructions,
      input: `请提取以下报告内容：\n\n${reportMarkdown}`,
      max_output_tokens: Math.min(getMaxOutputTokens(), 4096)
    }, { timeout: 50000 });

    let jsonStr = response.output_text || '{}';
    jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsedJSON = JSON.parse(jsonStr);

    return json(200, { parsedJSON, model: usedModel });
  } catch (error) {
    console.warn(`[V2] Metadata extraction failed with model ${usedModel}: ${error.message}. Falling back to gpt-4o-mini...`);
    try {
      usedModel = 'gpt-4o-mini';
      const fallbackResponse = await client.responses.create({
        model: usedModel,
        instructions: systemInstructions,
        input: `请提取以下报告内容：\n\n${reportMarkdown}`,
        max_output_tokens: Math.min(getMaxOutputTokens(), 4096)
      }, { timeout: 40000 });

      let jsonStr = fallbackResponse.output_text || '{}';
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      const parsedJSON = JSON.parse(jsonStr);

      return json(200, { parsedJSON, model: usedModel });
    } catch (fallbackError) {
      console.error('[V2] Both primary and fallback models failed for metadata extraction:', fallbackError);
      return json(502, { error: `元数据提取失败: ${error.message}. 备用模型也失败: ${fallbackError.message}` });
    }
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
