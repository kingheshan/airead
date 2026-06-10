import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { promptText } from './prompt-text.mjs';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';
const MAX_MATERIAL_CHARS = Number(process.env.MAX_MATERIAL_CHARS || 60000);
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS || 16384);

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
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Load prompt dynamically from AIRead提示词.md
  let instructions = loadSystemPrompt();
  if (!instructions) {
    return json(500, { error: '未找到 AIRead提示词.md 文件，请确认其放置在项目根目录。' });
  }
  // Append conciseness rules to prevent timeouts (limit output tokens)
  instructions += `\n\n【极其重要的生成字数限制与极速响应规则 (CRITICAL SPEED & CONCISENESS RULE)】:
为了防止接口超时，你必须以极度精炼、字字珠玑的方式进行输出：
1. 报告必须包含全部 25 个部分，但每个部分仅输出 1-2 句最核心的要点/结论/行动指南（如果是列表或矩阵，限制在最多 2-3 个条目/人物，且每个人物/条目仅用 1 句话概括）。
2. 严禁冗长废话与背景铺垫。必须句句是干货，直接给结论、模型或痛点，避免大篇幅段落。
3. 全文的 Markdown 文本（不含末尾的 JSON 沉淀块）总字数应控制在 1500-2500 字以内，以保证在 20-30 秒内输出完毕。
4. 最后的 JSON 沉淀块格式必须完整且正确，但里面沉淀的条目也不要过多（每个数组限制在 2 个对象即可）。`;

  const userPrompt = buildUserPrompt(input, chunks);

  try {
    console.log(`[V2] Requesting report generation with model ${MODEL}...`);
    const response = await client.responses.create({
      model: MODEL,
      instructions,
      input: userPrompt,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      ...(process.env.OPENAI_REASONING_EFFORT ? { reasoning: { effort: process.env.OPENAI_REASONING_EFFORT } } : {})
    });

    return json(200, {
      report: response.output_text || '',
      model: MODEL,
      truncated: input.truncated,
      generatedAt: new Date().toISOString(),
      chunks: chunks
    });
  } catch (error) {
    console.error('[V2] generate-report error:', error);
    const message = error?.message || 'OpenAI API request failed.';
    return json(502, { error: message });
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
  const truncated = rawMaterials.length > MAX_MATERIAL_CHARS;
  return {
    title: clean(body.title, 120),
    author: clean(body.author, 120),
    category: clean(body.category, 40),
    categoryLabel: clean(body.categoryLabel, 80),
    depth: clean(body.depth, 40),
    depthLabel: clean(body.depthLabel, 80),
    goal: clean(body.goal, 1000),
    background: clean(body.background, 1500),
    materials: rawMaterials.slice(0, MAX_MATERIAL_CHARS),
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
${input.truncated ? `注意：材料过长，系统已截断到前 ${MAX_MATERIAL_CHARS} 字。\n` : ''}${formattedMaterials}

请选择使用“CEO 作战模式”（深度拆解模式），开始生成包含 25 个部分的完整认知操作系统，并在报告最后输出符合规范的 JSON 沉淀块。

【极其重要的极速输出要求 (CRITICAL PERFORMANCE REQUIREMENT)】：
为了防止接口超时，你必须以极度精炼、字字珠玑的方式进行输出：
1. 必须覆盖全部 25 个部分，但每个部分仅输出 1-2 句最核心的内容/结论/建议。
2. 凡是涉及到矩阵、列表、条目的部分（例如第11部分“全球顶级人物视角矩阵”、第12部分“中国顶级产业实战视角矩阵”），每个人物或条目只用一句话提炼其核心观点，且最多只提供 2 个人物/条目，绝不展开铺开写。
3. 严格禁止任何多余的转折、寒暄、铺垫 and 背景介绍，直接给出结论和行动指南。
4. 全文的 Markdown 文本（不含最后第25部分的 JSON）总长度必须控制在 1500-2500 字以内，字数越少、结论越犀利越好，绝不拖泥带水。
5. 第25部分的 JSON 必须包含在 Markdown 的 \`\`\`json 块中，并且字段和结构必须与模板完全一致，但里面的数组不要包含多于 2 个的对象元素，保持数据精炼。
确保能够以极高的效率（在 25 秒内）返回完整的拆书报告。`;
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
