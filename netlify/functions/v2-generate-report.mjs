import { getOpenAIClient, getModel } from './openai-helper.mjs';
import fs from 'fs';
import path from 'path';
import { promptText } from './prompt-text.mjs';
const getMaxMaterialChars = () => Number(process.env.MAX_MATERIAL_CHARS || 60000);
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

  const input = normalizeInput(body);
  const validationError = validateInput(input);
  if (validationError) {
    return json(400, { error: validationError });
  }

  const chunks = chunkMaterials(input.materials);
  const client = getOpenAIClient();
  
  // Load prompt dynamically from AIRead提示词.md
  let instructions = loadSystemPrompt();
  if (!instructions) {
    return json(500, { error: '未找到 AIRead提示词.md 文件，请确认其放置在项目根目录。' });
  }
  // Append moderate length constraint to prompt to balance speed and detail
  instructions += `\n\n【生成篇幅与效率要求 (PERFORMANCE & DETAIL BALANCE)】:
为了兼顾拆解深度与系统响应速度，请严格遵守：
1. 报告仅需包含第 0 至 12 部分（即：“0. 材料边界与可信度说明” 至 “12. 中国顶级产业实战视角矩阵”），绝对禁止生成之后的第 13-25 部分。
2. 每个部分输出 2-4 个最核心的要点句或行动指南，可使用列表；严禁冗长铺垫和废话，直切要害。
3. 严禁在最后输出任何 JSON 沉淀块。
4. 全文的 Markdown 总字数控制在 1800-2600 字之间。
5. Markdown 格式要求：每个章节标题独立成行（如 “## 1. 一句话拆书”），标题行与正文之间必须空一行，正文使用普通段落或列表。`;

  const userPrompt = buildUserPrompt(input, chunks);

  let response;
  let usedModel = getModel();
  
  try {
    console.log(`[V2] Requesting report generation with model ${usedModel}...`);
    // Set explicit timeout of 60 seconds for the primary model call
    response = await client.responses.create({
      model: usedModel,
      instructions,
      input: userPrompt,
      max_output_tokens: getMaxOutputTokens(),
      ...(process.env.OPENAI_REASONING_EFFORT && (usedModel.startsWith('o1') || usedModel.startsWith('o3'))
         ? { reasoning: { effort: process.env.OPENAI_REASONING_EFFORT } }
         : {})
    }, { timeout: 60000 });

    return json(200, {
      report: response.output_text || '',
      model: usedModel,
      truncated: input.truncated,
      generatedAt: new Date().toISOString(),
      chunks: chunks
    });
  } catch (error) {
    // If primary model failed or timed out, fall back to gpt-4o-mini to guarantee response speed
    console.warn(`[V2] Primary model ${usedModel} failed or timed out: ${error.message}. Falling back to gpt-4o-mini...`);
    try {
      usedModel = 'gpt-4o-mini';
      const fallbackResponse = await client.responses.create({
        model: usedModel,
        instructions,
        input: userPrompt,
        max_output_tokens: getMaxOutputTokens()
      }, { timeout: 45000 }); // 45s timeout for fallback

      return json(200, {
        report: fallbackResponse.output_text || '',
        model: usedModel,
        truncated: input.truncated,
        generatedAt: new Date().toISOString(),
        chunks: chunks
      });
    } catch (fallbackError) {
      console.error('[V2] Both primary and fallback models failed:', fallbackError);
      return json(502, { error: `报告生成失败: ${error.message}. 备用模型也失败: ${fallbackError.message}` });
    }
  }
}

function loadSystemPrompt() {
  if (promptText) {
    return promptText;
  }
  const paths = [
    path.resolve(process.cwd(), 'AIRead提示词.md'),
    path.resolve(process.cwd(), 'netlify/functions/AIRead提示词.md'),
    'AIRead提示词.md',
    '../AIRead提示词.md',
    '../../AIRead提示词.md'
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
      }
    } catch (e) {
      // ignore
    }
  }
  return '';
}

function normalizeInput(body) {
  const rawMaterials = String(body.materials || '').trim();
  const truncated = rawMaterials.length > getMaxMaterialChars();
  return {
    title: clean(body.title, 120),
    author: clean(body.author, 120),
    category: clean(body.category, 40),
    categoryLabel: clean(body.categoryLabel, 80),
    depth: clean(body.depth, 40),
    depthLabel: clean(body.depthLabel, 80),
    goal: clean(body.goal, 1000),
    background: clean(body.background, 1500),
    materials: rawMaterials.slice(0, getMaxMaterialChars()),
    truncated
  };
}

function clean(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function validateInput(input) {
  if (!input.title) return '缺少书名 title。';
  if (!input.goal) return '缺少阅读目标 goal。';
  if (!input.materials || input.materials.length < 80) {
    return '材料太少。请至少提供 80 字以上的目录、摘录、章节摘要或读书笔记。';
  }
  return '';
}

function buildUserPrompt(input, chunks = []) {
  const formattedMaterials = chunks.length > 0
    ? chunks.map(c => `[Ref-${c.id}] (标题: ${c.title})\n${c.content}`).join('\n\n')
    : input.materials;

  return `请根据系统指令（System Instructions）的规则，开始拆解以下书籍。

【一、基础信息】
书名：${input.title}
作者：${input.author || '未指定'}
我读这本书的目的：${input.goal}
我的身份 / 角色：CEO / 创业团队负责人
我的业务 / 工作 / 人生背景：${input.background || 'K12 AI 编程教育创业背景，关注产品创新、商业变现与团队共学'}
我所在行业：AI 与教育科技 (EdTech)
我当前阶段：产品探索与市场验证期

可用材料：
${input.truncated ? `注意：材料过长，系统已截断到前 ${getMaxMaterialChars()} 字。\n` : ''}${formattedMaterials}

请选择使用“CEO 作战模式”（深度拆解模式），开始生成包含第 0 至 12 部分的拆书报告，不要生成之后的其他模块内容或最后的 JSON 沉淀块。

【生成篇幅与效率要求 (PERFORMANCE & DETAIL BALANCE)】：
为了保证系统响应速度，避免网关超时，请在保持极高拆解质量的前提下极度控制篇幅：
1. 仅包含第 0 至 12 部分（即：“0. 材料边界与可信度说明” 至 “12. 中国顶级产业实战视角矩阵”），不需要生成第 13 部分及以后的任何内容。
2. 每个部分仅需输出 1 句最核心的要点、结论与策略建议，严禁任何冗长铺垫和废话，直接给出结论 and 行动指南。
3. 严禁在最后输出任何 JSON 沉淀块。
4. 全文的 Markdown 总字数必须控制在 800-1200 字之间。`;
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

function chunkMaterials(text) {
  if (!text) return [];

  const lines = text.split('\n');
  const chunks = [];
  let currentChunk = null;
  let chunkCounter = 1;

  const hasHeadings = text.includes('## ') || text.includes('### ');

  function pushCurrent() {
    if (currentChunk) {
      const trimmed = currentChunk.content.trim();
      if (trimmed) {
        chunks.push({
          id: chunkCounter++,
          title: currentChunk.title || `材料片段 #${chunkCounter}`,
          content: trimmed
        });
      }
      currentChunk = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let isNewChunk = false;
    let title = '';

    if (hasHeadings) {
      if (line.startsWith('### ')) {
        isNewChunk = true;
        title = line.replace(/^###\s+/, '');
      } else if (line.startsWith('## ')) {
        isNewChunk = true;
        title = line.replace(/^##\s+/, '');
      }
    } else {
      if (/^\d+\.\s+/.test(line)) {
        isNewChunk = true;
        title = line.match(/^\d+\.\s*(.*)/)?.[1]?.slice(0, 40) || '观点列表';
      } else if (/^[-\*]\s+/.test(line)) {
        isNewChunk = true;
        title = line.match(/^[-\*]\s*(.*)/)?.[1]?.slice(0, 40) || '条目';
      }
    }

    if (isNewChunk) {
      pushCurrent();
      currentChunk = {
        title,
        content: rawLine
      };
    } else {
      if (!currentChunk) {
        currentChunk = {
          title: '基本材料',
          content: ''
        };
      }
      currentChunk.content += (currentChunk.content ? '\n' : '') + rawLine;
    }
  }

  pushCurrent();
  return chunks;
}
