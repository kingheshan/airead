import fs from 'fs';
import path from 'path';
import { handler as generateReportHandler } from '../netlify/functions/v2-generate-report.mjs';
import { handler as generateMetadataHandler } from '../netlify/functions/v2-generate-metadata.mjs';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
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

async function runTest() {
  console.log('=== STEP 1: Testing Shortened v2-generate-report ===');
  
  const reportEvent = {
    httpMethod: 'POST',
    body: JSON.stringify({
      title: '《从0到1》',
      author: 'Peter Thiel',
      goal: '寻找我们在K12少儿编程教育市场的竞争壁垒。',
      background: '小鹿编程业务负责人，关注产品创新和垄断定价。',
      materials: `从0到1的核心是“垄断”。企业要追求垄断利润而不是完全竞争。
要建立垄断，通常需要满足四个维度：
1. 专利技术：比如谷歌的搜索算法，领先对手10倍以上。
2. 网络效应：用户越多产品越有价值，比如微信。
3. 规模经济：服务规模越大，边际成本越低。
4. 品牌优势：比如苹果的品牌溢价。
创业公司应该从小市场起步，先垄断一个极细分的小市场，然后再逐步扩张到邻近市场。`
    })
  };

  const reportStart = Date.now();
  let reportResult;
  try {
    reportResult = await generateReportHandler(reportEvent, {});
    console.log(`v2-generate-report completed in ${(Date.now() - reportStart) / 1000}s`);
    console.log(`HTTP Status: ${reportResult.statusCode}`);
    
    const body = JSON.parse(reportResult.body);
    if (reportResult.statusCode !== 200) {
      console.error('Report generation failed:', body.error);
      return;
    }
    
    console.log(`Report Length: ${body.report ? body.report.length : 0} chars`);
    console.log(`Model Used: ${body.model}`);
    console.log(`Contains JSON block: ${body.report.includes('```json') || (body.report.includes('{') && body.report.includes('}'))}`);
    console.log(`Report Sample:\n${body.report.slice(0, 400)}...\n`);
    
    console.log('=== STEP 2: Testing On-Demand v2-generate-metadata ===');
    const metadataEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        title: '《从0到1》',
        author: 'Peter Thiel',
        reportMarkdown: body.report
      })
    };
    
    const metadataStart = Date.now();
    const metadataResult = await generateMetadataHandler(metadataEvent, {});
    console.log(`v2-generate-metadata completed in ${(Date.now() - metadataStart) / 1000}s`);
    console.log(`HTTP Status: ${metadataResult.statusCode}`);
    
    const metadataBody = JSON.parse(metadataResult.body);
    if (metadataResult.statusCode !== 200) {
      console.error('Metadata extraction failed:', metadataBody.error);
      return;
    }
    
    console.log('Metadata extraction successful!');
    console.log('Extracted Metadata Model Used:', metadataBody.model);
    console.log('Parsed JSON metadata structure:');
    console.log(JSON.stringify(metadataBody.parsedJSON, null, 2));
    
  } catch (err) {
    console.error('Test run failed with error:', err);
  }
}

runTest();
