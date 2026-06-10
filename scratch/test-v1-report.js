import { handler } from '../netlify/functions/generate-report.mjs';
import fs from 'fs';

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

const event = {
  httpMethod: 'POST',
  body: JSON.stringify({
    title: '《从 0 到 1》',
    author: '彼得·蒂尔',
    category: 'strategy',
    categoryLabel: '战略/商业模式',
    depth: 'deep',
    depthLabel: 'CEO 作战版',
    goal: '我想深入了解书中的核心内容、观点和方法论，同时提炼书中的金句',
    background: '小鹿AI编程业务负责人，关注课程创新与商业化',
    materials: `目录/笔记示例：
1. 从 0 到 1：进步分为水平复制和垂直创新。
2. 竞争会让企业陷入同质化，垄断企业才能拥有长期利润。
3. 创业公司应该从小市场切入，在细分市场建立主导地位后再扩张。
4. 好公司通常建立在“秘密”之上，也就是别人还没有看到的非共识真相。
5. 创始人的特质和企业文化是早期阶段的关键。`
  })
};

console.log('Starting v1-generate-report with model:', process.env.OPENAI_MODEL || 'gpt-5.5');
const start = Date.now();
try {
  const response = await handler(event);
  const duration = (Date.now() - start) / 1000;
  console.log('Response status:', response.statusCode);
  console.log('Response duration:', duration, 'seconds');
  if (response.statusCode === 200) {
    const body = JSON.parse(response.body);
    console.log('Report length:', body.report.length);
  } else {
    console.error('Failed:', response.body);
  }
} catch (err) {
  console.error('Execution error:', err);
}
