import OpenAI from 'openai';

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
  const instructions = buildSystemInstructions();
  const userPrompt = buildUserPrompt(input, chunks);

  try {
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
    const message = error?.message || 'OpenAI API request failed.';
    return json(502, { error: message });
  }
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

function buildSystemInstructions() {
  return `你是“小鹿 AI 拆书工坊”的首席拆书官、战略顾问、反方辩手和行动教练。

你的任务：基于用户提供的书名、阅读目标、业务背景、目录/摘录/笔记，生成一份高质量中文拆书报告。

关键原则：
1. 不做普通摘要，要把书拆成“可理解、可判断、可迁移、可执行、可沉淀”的认知系统。
2. 严格区分“材料中明确出现的信息”和“你的业务推断”。推断必须标注为“基于材料的推断”。
3. 如果材料不足，不要假装读过整本书。请在报告中明确写出“材料边界”和“需要补充的材料”。
4. 不要大段引用原文。必要引用只能短句，且以分析和评论为主，不生成可替代原书的完整内容。
5. 输出要服务于小鹿 AI 编程：K12 AI 编程线上教育、大班直播课、299 元中价品、产品创新、市场破局、健康盈利、AI 驱动业务重构、团队共学和长期战略。
6. 必须有判断、有取舍、有适用边界、有反方挑战、有业务动作。禁止空泛口号和鸡汤。
7. 使用 Markdown 输出，结构清晰，适合直接复制到飞书/Notion/团队培训文档。
8. 把行动写成可验证实验：行动名称、验证假设、具体做法、衡量指标、预期结果、失败后如何调整。
9. 材料引用与追溯 (Citations)：只要你的观点、模型、假设、挑战或行动建议直接或间接借鉴了输入材料中的内容，就必须在所生成的段落、要点或列表项末尾，使用 [Ref-X] 的格式进行引用标注（X 是输入材料里以 [Ref-X] 标明的数字，例如 [Ref-1]、[Ref-5]；若来源多处，可写如 [Ref-1][Ref-2]）。请严格只对材料中能找到直接依据的部分进行标注，纯业务推断无需标注。
10. 引用格式要求：仅使用已提供的 [Ref-X] 标签，且严禁修改拼写。这能帮助前端系统解析引用，实现点击溯源。

写作风格：董事会级清晰、创业者级务实、顾问级锋利。`; 
}

function buildUserPrompt(input, chunks = []) {
  const depthExtra = {
    standard: '标准版：完整覆盖 12 个模块，控制篇幅，重点清晰。',
    deep: '深度版：强化逻辑链、底层假设、反方辩论、行业边界和 CEO 决策启发。',
    action: '行动版：强化业务迁移、7/30/90 天行动实验、指标、负责人建议和复盘模板。',
    team: '团队版：强化团队分享、培训提纲、讨论题、作业和共学复盘。'
  }[input.depth] || '标准版：完整覆盖 12 个模块。';

  const formattedMaterials = chunks.length > 0
    ? chunks.map(c => `[Ref-${c.id}] (标题: ${c.title})\n${c.content}`).join('\n\n')
    : input.materials;

  return `请生成“小鹿 AI 拆书报告”。

【书籍信息】
书名：${input.title}
作者：${input.author || '未提供'}
书籍类型：${input.categoryLabel || input.category || '未指定'}
报告深度：${input.depthLabel || input.depth || '标准版'}
深度要求：${depthExtra}

【我的阅读目标】
${input.goal}

【我的业务背景】
${input.background || 'K12 AI 编程教育创业负责人，关注产品创新、市场破局、组织效率、AI 落地、商业模式和长期战略。'}

【可用材料】
${input.truncated ? `注意：材料过长，系统已截断到前 ${MAX_MATERIAL_CHARS} 字。\n` : ''}${formattedMaterials}

【输出结构】
请严格按照以下结构输出：

# 小鹿 AI 拆书报告｜${input.title}

## 0. 材料边界与可信度
- 已提供材料包括什么
- 哪些判断可以比较确定
- 哪些判断只是基于材料的推断
- 还需要补充什么材料才能拆得更准

## 1. 一句话拆书
不超过 50 字，必须体现这本书真正要解决的问题。

## 2. 这本书要解决的根问题
- 作者看到的世界问题是什么
- 旧方法为什么失效
- 作者试图提供什么新方法
- 这个问题对小鹿是否重要，为什么

## 3. 全书核心逻辑地图
用“问题 → 假设 → 论证 → 结论 → 行动”的形式输出。
如果材料不足以还原全书，请明确说明这是基于材料的逻辑重构。

## 4. 核心观点拆解
提炼 5 到 10 个核心观点。每个观点按以下格式：
- 作者原意
- 背后的底层逻辑
- 材料依据或案例
- 为什么重要
- 适用场景
- 不适用场景
- 小鹿应该如何理解

## 5. 关键概念和模型
提炼书中或材料中出现的核心概念、框架、模型。如果材料中没有显性模型，请归纳隐性模型。每个模型包括：
- 模型解释
- 解决什么问题
- 使用步骤
- 一个小鹿业务案例
- 可能误用

## 6. 作者的底层假设
至少 5 条。每条包括：
- 假设是什么
- 为什么重要
- 成立条件
- 不成立时的风险

## 7. 反方辩论
从严厉反方视角挑战这本书：
- 作者可能忽略什么
- 哪些观点可能过度简化
- 哪些案例可能有幸存者偏差
- 哪些结论在今天可能过时
- 哪些观点在中国市场/教育行业/创业公司中未必适用
- 小鹿使用时最容易踩什么坑

## 8. 迁移到小鹿业务
必须落到具体业务动作，分别输出：
- 产品创新启发
- 市场增长启发
- 299 元中价品启发
- 组织管理启发
- AI 驱动业务重构启发
- 教育行业竞争启发
- CEO 个人认知升级启发

## 9. 7 / 30 / 90 天行动清单
分别输出 3 到 5 个行动。每个行动必须包含：
- 行动名称
- 要验证的假设
- 具体做法
- 衡量指标
- 预期结果
- 失败后如何调整

## 10. 认知升级总结
- 这本书可能改变哪些认知
- 哪些观点值得长期内化
- 哪些观点只适合参考
- 小鹿应该停止做什么
- 小鹿应该开始做什么
- 小鹿应该继续强化什么

## 11. 金句重构
用自己的话重构 10 句，不要照搬原文。要求犀利、可记忆、有行动指向、适合团队分享。

## 12. 团队共学版
- 3 分钟口头分享稿
- 10 分钟培训提纲
- 5 个团队讨论问题
- 3 个团队作业
- 本周可以启动的 1 个业务实验
- 复盘模板：目标、假设、行动、数据、结论、下一步

最后请用一句话总结：这本书对小鹿最大的价值是什么。`;
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
