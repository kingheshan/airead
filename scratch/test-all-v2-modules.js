import fetch from 'node-fetch';

const urlArg = process.argv[2];
if (!urlArg) {
  console.error('Error: Please provide the deployed EdgeOne URL with tokens as an argument.');
  console.error('Example: node scratch/test-all-v2-modules.js "https://airead-qmdpvrfp.edgeone.cool?eo_token=xxx&eo_time=yyy"');
  process.exit(1);
}

const parsedUrl = new URL(urlArg);
const baseUrl = parsedUrl.origin;
const token = parsedUrl.searchParams.get('eo_token');
const time = parsedUrl.searchParams.get('eo_time');

console.log(`===================================================`);
console.log(`Starting End-to-End Live API Tests on Deployed EdgeOne`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Credentials: eo_token=${token}, eo_time=${time}`);
console.log(`===================================================`);

const cookieHeader = `eo_token=${token}; eo_time=${time}`;

// Helper to make POST requests to functions
async function callApi(funcName, body) {
  const url = `${baseUrl}/.netlify/functions/${funcName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader
    },
    body: JSON.stringify(body)
  });
  
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    // If not JSON, return status and text
    return { status: response.status, rawText: text.slice(0, 300) };
  }
  return { status: response.status, data: json };
}

async function runTests() {
  let reportMarkdown = '';
  
  // Test Data
  const title = "精益创业 (The Lean Startup)";
  const author = "埃里克·莱斯 (Eric Ries)";
  const goal = "快速验证K12 AI编程教育MVP产品";
  const background = "AI教育科技创业背景，关注商业变现和最小可行性产品验证";
  const materials = `第1章：开端。创业是某种形式 of 创新管理，需要全新的思考方式。
第2章：定义。凡是在极度不确定情况下创建新产品或服务的组织，都是创业公司。
第3章：学习。精益创业的核心是“构建-衡量-学习”的反馈循环。我们需要快速验证我们的价值假设和增长假设，而不是把时间浪费在没有经过市场检验的大量开发上。
第4章：实验。将庞大的产品构想拆解为最小可行性产品 (MVP)，快速投放到市场中看用户的实际行动，而不是做无用的问卷调查。通过真实的付费或使用行为来调整方向。`;

  // 1. Test Report Generation (v2-generate-report)
  console.log('\n[TEST 1] Testing v2-generate-report...');
  const res1 = await callApi('v2-generate-report', { title, author, goal, background, materials });
  if (res1.status === 200 && res1.data && res1.data.report) {
    console.log('✅ v2-generate-report PASSED');
    console.log(`   Model Used: ${res1.data.model}`);
    console.log(`   Report Length: ${res1.data.report.length} chars`);
    reportMarkdown = res1.data.report;
  } else {
    console.error('❌ v2-generate-report FAILED', res1);
    process.exit(1);
  }

  // 2. Test Metadata Extraction (v2-generate-metadata)
  console.log('\n[TEST 2] Testing v2-generate-metadata...');
  const res2 = await callApi('v2-generate-metadata', { title, author, reportMarkdown });
  if (res2.status === 200 && res2.data && res2.data.parsedJSON) {
    console.log('✅ v2-generate-metadata PASSED');
    console.log(`   Category: ${res2.data.parsedJSON.book_card.category}`);
    console.log(`   Models Extracted: ${res2.data.parsedJSON.models.map(m => m.name).join(', ')}`);
  } else {
    console.error('❌ v2-generate-metadata FAILED', res2);
    process.exit(1);
  }

  // 3. Test Skill Distillation (v2-distill-skill)
  console.log('\n[TEST 3] Testing v2-distill-skill...');
  const res3 = await callApi('v2-distill-skill', { title, author, reportText: reportMarkdown });
  if (res3.status === 200 && res3.data && res3.data.skillMarkdown) {
    console.log('✅ v2-distill-skill PASSED');
    console.log(`   Skill Description: ${res3.data.skillMarkdown.slice(0, 150).replace(/\n/g, ' ')}...`);
  } else {
    console.error('❌ v2-distill-skill FAILED', res3);
    process.exit(1);
  }

  // 4. Test Podcast Audio Briefing (v2-generate-podcast)
  console.log('\n[TEST 4] Testing v2-generate-podcast...');
  const res4 = await callApi('v2-generate-podcast', { title, author, report: reportMarkdown, goal });
  if (res4.status === 200 && res4.data && res4.data.audioUrl) {
    console.log('✅ v2-generate-podcast PASSED');
    console.log(`   Audio URL Length: ${res4.data.audioUrl.length} chars`);
    console.log(`   Transcript Snippet: ${res4.data.transcript || res4.data.script ? (res4.data.transcript || res4.data.script).slice(0, 100) : ''}...`);
  } else {
    console.error('❌ v2-generate-podcast FAILED', res4);
    process.exit(1);
  }

  // 5. Test AI Double Debate (v2-double-debate)
  console.log('\n[TEST 5] Testing v2-double-debate...');
  const res5 = await callApi('v2-double-debate', {
    author1: "埃里克·莱斯",
    author2: "彼得·蒂尔",
    query: "K12 AI编程教育应该快速跑通MVP，还是从第一天就追求完美的10倍体验垄断？",
    bookTitle: title
  });
  const debateText = res5.data ? (res5.data.debate || res5.data.debateMarkdown) : null;
  if (res5.status === 200 && debateText) {
    console.log('✅ v2-double-debate PASSED');
    console.log(`   Debate Length: ${debateText.length} chars`);
    console.log(`   Debate Snippet: ${debateText.slice(0, 150).replace(/\n/g, ' ')}...`);
  } else {
    console.error('❌ v2-double-debate FAILED', res5);
    process.exit(1);
  }

  // 6. Test Strategy Simulator Sandbox (v2-strategy-simulator)
  console.log('\n[TEST 6] Testing v2-strategy-simulator...');
  const res6 = await callApi('v2-strategy-simulator', {
    title,
    scenario: "面对当前激烈的K12 AI编程教育竞争，我的商业模型参数为：CAC 150元, 转化率2.5%, LTV 800元, 初始资金 100000元, 每月固定支出 8000元, 期望运行12个月。",
    goal,
    budget: 100000,
    teamSize: 5
  });
  if (res6.status === 200 && res6.data && typeof res6.data.successProbability === 'number') {
    console.log('✅ v2-strategy-simulator PASSED');
    console.log(`   Success Probability: ${res6.data.successProbability}%`);
    console.log(`   Simulation Months count: ${res6.data.simulationData?.length || 0}`);
  } else {
    console.error('❌ v2-strategy-simulator FAILED', res6);
    process.exit(1);
  }

  // 7. Test Roundtable Chat (v2-roundtable-chat)
  console.log('\n[TEST 7] Testing v2-roundtable-chat...');
  const res7 = await callApi('v2-roundtable-chat', {
    title,
    authors: ["埃里克·莱斯", "彼得·蒂尔"],
    messages: [{ role: "user", content: "面对当前激烈的K12 AI编程教育竞争，我们该如何最快测试出真实的用户需求？" }]
  });
  const roundtableText = res7.data ? (res7.data.message || res7.data.assistantMessage) : null;
  if (res7.status === 200 && roundtableText) {
    console.log('✅ v2-roundtable-chat PASSED');
    console.log(`   Assistant Response: ${roundtableText.slice(0, 150).replace(/\n/g, ' ')}...`);
  } else {
    console.error('❌ v2-roundtable-chat FAILED', res7);
    process.exit(1);
  }

  // 8. Test Infographic Generation (v2-generate-infographic)
  console.log('\n[TEST 8] Testing v2-generate-infographic (strategy_card)...');
  const res8 = await callApi('v2-generate-infographic', {
    title,
    author,
    categoryLabel: "商业策略",
    goal,
    cardType: "strategy_card"
  });
  if (res8.status === 200 && res8.data && res8.data.imageUrl) {
    console.log('✅ v2-generate-infographic PASSED');
    console.log(`   Image URL: ${res8.data.imageUrl.slice(0, 80)}...`);
  } else {
    console.error('❌ v2-generate-infographic FAILED', res8);
    process.exit(1);
  }

  console.log('\n===================================================');
  console.log('🎉 ALL Live EdgeOne API Tests Passed Successfully!');
  console.log('===================================================');
}

runTests();
