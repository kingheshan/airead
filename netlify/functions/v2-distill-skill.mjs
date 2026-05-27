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

  const { title, author, reportText } = body;
  if (!title || !reportText) {
    return json(400, { error: 'Missing required parameters: title and reportText.' });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemInstructions = `你是一个顶级 AI 技能包蒸馏官（AI Skill Compiler）。
你的任务是将一份关于特定书籍的深度拆书报告，重构并蒸馏为一个符合 Antigravity/AGY 规范的 AI 技能指令包（SKILL.md）。

输出格式规范：
必须严格使用 Markdown 格式输出，且文档最顶端包含标准的 YAML Frontmatter 元数据块：
---
name: [书籍的英文/拼音简短标识，如 zero-to-one]
description: [简短描述该书籍的方法论核心，说明它如何指导用户进行工作决策或个人成长]
---

技能包文档必须包含以下章节结构：

# [书籍名称] 认知执行技能 (Skill Definition)

## 一、 技能核心背景与哲学 (Philosophy)
- 简述该书底层思想逻辑，它的核心决策假设。
- 适用与不适用场景边界。

## 二、 AI 助手扮演角色与执行规范 (System Instruction Extensions)
- 详细说明：当此技能包被加载到 AI 助手（如 Antigravity 智能体）中时，助手应该扮演何种身份角色（如“精益运营教练”、“非共识战略分析师”）。
- AI 助手应遵循的核心对话原则、语气风格与执行要求。

## 三、 核心行动框架与操作步骤 (Action Frameworks)
- 提取书中 2-3 个最关键的实践模型，给出具体的指令，告诉 AI 如何引导用户执行这些步骤。
- 例如：引导用户画出因果回路、设计最小可行产品（MVP）验证指标等。

## 四、 首席执行官/个人成长清单 (Operational Checklists)
- 整理为具体的、可落地的核对清单（Checklist）。
- 告诉用户和 AI 在日常运营或成长规划中需要对照检查的动作。

## 五、 反向避坑指南与红线警告 (Anti-Patterns & Warning Signs)
- 详细罗列在应用此技能时最容易犯的错误和误区。
- 指明 AI 助手在检测到用户什么行为或想法时，应主动发出红线警告并提供纠偏方案。

请直接输出符合上述结构的 Markdown 格式技能卡，不要包含任何前后解释文字或 \`\`\` 包装。`;

  try {
    console.log(`[V2] Calling distill-skill for ${title} with model ${MODEL}...`);
    const response = await client.responses.create({
      model: MODEL,
      instructions: systemInstructions,
      input: `书名：《${title}》\n作者：${author || '未知作者'}\n\n以下是该书籍的详细拆解报告数据，请基于此进行提炼与蒸馏：\n\n${reportText}`,
      max_output_tokens: Number(process.env.MAX_OUTPUT_TOKENS || 16384),
      ...(process.env.OPENAI_REASONING_EFFORT ? { reasoning: { effort: process.env.OPENAI_REASONING_EFFORT } } : {})
    });

    return json(200, {
      skillMarkdown: response.output_text || '',
      model: MODEL
    });
  } catch (error) {
    console.error('[V2] distill-skill error:', error);
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
