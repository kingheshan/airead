import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Load .env
const envPath = '/Users/king/Desktop/xiaoluAIRead/.env';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  });
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || 'gpt-5.5';

// Load AIRead提示词.md
const promptPath = '/Users/king/Desktop/xiaoluAIRead/AIRead提示词.md';
const instructions = fs.readFileSync(promptPath, 'utf8');

const userPrompt = `请根据系统指令（System Instructions）的规则，开始拆解以下书籍。

【一、基础信息】
书名：精益创业
作者：Eric Ries
我读这本书的目的：快速验证我们的少儿编程产品MVP设想。
我的身份 / 角色：CEO / 创业团队负责人
我的业务 / 工作 / 人生背景：K12 AI 编程教育创业背景，关注产品创新、商业变现与团队共学
我所在行业：AI 与教育科技 (EdTech)
我当前阶段：产品探索与市场验证期

可用材料：
[Ref-1] (标题: 核心闭环)
精益创业的核心是“构建-衡量-学习”反馈循环。创业公司不要一开始就投入巨资开发完美产品，而是设计最小可行产品(MVP)进入市场进行快速概念测试，并通过反馈进行科学验证或转型(Pivot)。

请选择使用“CEO 作战模式”（深度拆解模式），开始生成包含 25 个部分的完整认知操作系统，并在报告最后输出符合规范 of JSON 沉淀块。`;

console.log('Sending request to model:', model, 'with reasoning effort: low...');
const start = Date.now();

try {
  const response = await client.responses.create({
    model: model,
    instructions: instructions,
    input: userPrompt,
    max_output_tokens: 16384,
    reasoning: { effort: 'low' }
  });
  console.log(`Success! Execution Time: ${(Date.now() - start) / 1000}s`);
  console.log('Output length:', response.output_text ? response.output_text.length : 0);
  console.log('Sample output:', response.output_text ? response.output_text.slice(0, 500) + '...' : 'None');
} catch (err) {
  console.error('API Error:', err.message);
}
