import { handler } from '../netlify/functions/v2-generate-report.mjs';
import fs from 'fs';

const event = {
  httpMethod: 'POST',
  body: JSON.stringify({
    title: '《精益创业》',
    author: 'Eric Ries',
    category: 'strategy',
    categoryLabel: '战略/商业模式',
    depth: 'deep',
    depthLabel: 'CEO 作战版',
    goal: '我想深入了解书中的核心内容、观点和方法论，同时提炼书中的金句',
    background: 'K12 AI 编程教育创业背景，关注产品创新、商业变现与团队共学',
    materials: `目录/笔记示例：
1. 精益创业的核心是“构建-衡量-学习”反馈循环。
2. 创业公司不要一开始就投入巨资开发完美产品，而是设计最小可行产品(MVP)进入市场进行快速概念测试，并通过反馈进行科学验证或转型(Pivot)。`
  })
};

// Set environment variables
process.env.OPENAI_API_KEY = 'REDACTED_API_KEY';
process.env.OPENAI_MODEL = 'gpt-5.5';

console.log('Starting v2-generate-report with gpt-5.5 (should trigger fallback to gpt-4o after 25 seconds)...');
const start = Date.now();
const response = await handler(event);
const duration = (Date.now() - start) / 1000;

console.log('Response status:', response.statusCode);
console.log('Response duration:', duration, 'seconds');
if (response.statusCode === 200) {
  const body = JSON.parse(response.body);
  console.log('Report generated successfully! Length:', body.report.length);
} else {
  console.error('Failed to generate report:', response.body);
}
