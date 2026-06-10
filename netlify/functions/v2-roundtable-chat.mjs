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

  const { title, authors, messages, skillsContext } = body;
  if (!authors || !messages || !Array.isArray(messages)) {
    return json(400, { error: 'Missing required parameters: authors and messages list.' });
  }

  const client = getOpenAIClient();

  let additionalSkillsInstructions = '';
  if (skillsContext && typeof skillsContext === 'object') {
    Object.keys(skillsContext).forEach(authorName => {
      additionalSkillsInstructions += `\n对于角色 "${authorName}"，请严格参考以下其专有的 AI 技能指令包（SKILL.md）以扮演该角色并使用其专属思想模型：\n【${authorName} 的技能定义】:\n${skillsContext[authorName]}\n`;
    });
  }

  const systemInstructions = `你是一个多作者虚拟圆桌会议系统。
用户将与以下虚拟原著作者/领袖进行交互式群聊：
群聊成员：
- 用户（你）
- 作者们: ${authors}
${additionalSkillsInstructions}

上下文书籍/业务场景: ${title || '未指定'}

你的任务：
1. 扮演这几位作者：当用户发言时，请基于被选定作者的方法论特征进行回复。
2. 保持多作者本色：如果群里有多个作者（例如：彼得·蒂尔、克里斯坦森），他们应该针对用户的提问，各自从自己的学术视角发表看法，有时可以简短点评对方的观点。
3. 格式清晰：在回复中，使用加粗的作者名字区分是谁的发言。
   例如：
   **彼得·蒂尔**：关于这个问题，我认为...
   
   **克里斯坦森**：彼得说得有道理，但我建议你从“非消费市场”入手，因为...
4. 务实落地：他们的回答要能够直接对接到用户的创业或学习背景，给出明确的战术启发。
5. 每次回答总长度控制在 600-800 字以内，避免过于冗长。`;

  // Build conversations for client responses API or chat API
  // In v2 we use Responses API since it is very robust.
  // We can format the history messages as lines in the input prompt to client.responses.create
  const formattedHistory = messages.map(m => `${m.role === 'user' ? '用户' : '作者顾问团'}: ${m.content}`).join('\n\n');
  const latestUserMessage = messages[messages.length - 1]?.content || '你好';

  try {
    const model = getModel();
    const isReasoning = model.includes('5.5') || model.startsWith('o1') || model.startsWith('o3');
    console.log(`[V2] Calling roundtable-chat with model ${model}...`);
    const response = await client.responses.create({
      model: model,
      instructions: systemInstructions,
      input: `这是群聊对话历史：\n${formattedHistory}\n\n请对此进行回复。`,
      max_output_tokens: Number(process.env.MAX_OUTPUT_TOKENS || 16384),
      ...(isReasoning && process.env.OPENAI_REASONING_EFFORT ? { reasoning: { effort: process.env.OPENAI_REASONING_EFFORT } } : {})
    });

    return json(200, {
      message: response.output_text || '',
      model: getModel()
    });
  } catch (error) {
    console.error('[V2] roundtable-chat error:', error);
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
