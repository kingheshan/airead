// Local E2E test for all V2 modules against `netlify dev` (http://localhost:8888).
// Usage: node scratch/test-local-all.js [--fast]   (--fast skips image & podcast)
const BASE = process.env.TEST_BASE_URL || 'http://localhost:8888';
const FAST = process.argv.includes('--fast');

async function callApi(funcName, body, timeoutMs = 120000) {
  const url = `${BASE}/.netlify/functions/${funcName}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {
      return { status: response.status, rawText: text.slice(0, 300), ms: Date.now() - startedAt };
    }
    return { status: response.status, data: json, ms: Date.now() - startedAt };
  } catch (e) {
    return { status: 0, error: e.name === 'AbortError' ? `client-timeout>${timeoutMs}ms` : e.message, ms: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
function record(name, ok, info) {
  results.push({ name, ok, info });
  console.log(`${ok ? '✅' : '❌'} ${name} ${info}`);
}

async function run() {
  const title = '精益创业 (The Lean Startup)';
  const author = '埃里克·莱斯 (Eric Ries)';
  const goal = '快速验证K12 AI编程教育MVP产品';
  const background = 'AI教育科技创业背景，关注商业变现和最小可行性产品验证';
  const materials = `第1章：开端。创业是某种形式的创新管理，需要全新的思考方式。
第2章：定义。凡是在极度不确定情况下创建新产品或服务的组织，都是创业公司。
第3章：学习。精益创业的核心是“构建-衡量-学习”的反馈循环。需要快速验证价值假设和增长假设。
第4章：实验。将庞大的产品构想拆解为最小可行性产品 (MVP)，快速投放到市场看用户的实际行动。`;

  let reportMarkdown = '';

  // 1. report
  let r = await callApi('v2-generate-report', { title, author, goal, background, materials });
  if (r.status === 200 && r.data?.report) {
    reportMarkdown = r.data.report;
    record('v2-generate-report', true, `model=${r.data.model} len=${r.data.report.length} ${r.ms}ms`);
  } else {
    record('v2-generate-report', false, JSON.stringify(r).slice(0, 300));
    reportMarkdown = '# 精益创业拆书报告\n核心：构建-衡量-学习循环；MVP 快速验证。';
  }

  // 2. metadata
  r = await callApi('v2-generate-metadata', { title, author, reportMarkdown });
  record('v2-generate-metadata', r.status === 200 && !!r.data?.parsedJSON,
    r.status === 200 ? `category=${r.data?.parsedJSON?.book_card?.category} models=${(r.data?.parsedJSON?.models || []).length} ${r.ms}ms` : JSON.stringify(r).slice(0, 300));

  // 3. distill skill
  r = await callApi('v2-distill-skill', { title, author, reportText: reportMarkdown });
  record('v2-distill-skill', r.status === 200 && !!r.data?.skillMarkdown,
    r.status === 200 ? `len=${r.data?.skillMarkdown?.length} ${r.ms}ms` : JSON.stringify(r).slice(0, 300));

  // 4. debate
  r = await callApi('v2-double-debate', {
    author1: '埃里克·莱斯', author2: '彼得·蒂尔',
    query: 'K12 AI编程教育应该快速跑通MVP，还是追求10倍体验垄断？', bookTitle: title
  });
  record('v2-double-debate', r.status === 200 && !!(r.data?.debate || r.data?.debateMarkdown),
    r.status === 200 ? `len=${(r.data?.debate || r.data?.debateMarkdown || '').length} ${r.ms}ms` : JSON.stringify(r).slice(0, 300));

  // 5. simulator
  r = await callApi('v2-strategy-simulator', {
    title, scenario: 'CAC 150元, 转化率2.5%, LTV 800元, 初始资金100000元, 月固定支出8000元, 期望12个月。',
    goal, budget: 100000, teamSize: 5
  });
  record('v2-strategy-simulator', r.status === 200 && typeof r.data?.successProbability === 'number',
    r.status === 200 ? `prob=${r.data?.successProbability}% months=${r.data?.simulationData?.length} ${r.ms}ms` : JSON.stringify(r).slice(0, 300));

  // 6. roundtable
  r = await callApi('v2-roundtable-chat', {
    title, authors: ['埃里克·莱斯', '彼得·蒂尔'],
    messages: [{ role: 'user', content: '如何最快测试出真实的用户需求？' }]
  });
  record('v2-roundtable-chat', r.status === 200 && !!(r.data?.message || r.data?.assistantMessage),
    r.status === 200 ? `len=${(r.data?.message || r.data?.assistantMessage || '').length} ${r.ms}ms` : JSON.stringify(r).slice(0, 300));

  if (!FAST) {
    // 7. podcast (script + TTS)
    r = await callApi('v2-generate-podcast', { title, author, report: reportMarkdown, goal }, 180000);
    record('v2-generate-podcast', r.status === 200 && !!r.data?.audioUrl && !r.data?.isSilentFallback,
      r.status === 200 ? `audioLen=${(r.data?.audioUrl || '').length} silentFallback=${r.data?.isSilentFallback} ${r.ms}ms` : JSON.stringify(r).slice(0, 300));

    // 8. infographic (gpt-image-2)
    r = await callApi('v2-generate-infographic', { title, author, categoryLabel: '商业策略', goal, cardType: 'strategy_card' }, 300000);
    record('v2-generate-infographic', r.status === 200 && !!r.data?.imageUrl,
      r.status === 200 ? `model=${r.data?.model} imgLen=${(r.data?.imageUrl || '').length} ${r.ms}ms` : JSON.stringify(r).slice(0, 300));
  }

  const failed = results.filter(x => !x.ok);
  console.log('\n========================================');
  console.log(failed.length === 0 ? '🎉 ALL LOCAL TESTS PASSED' : `⚠️ ${failed.length} FAILED: ${failed.map(f => f.name).join(', ')}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
