async function run() {
  console.log('Testing V2.0 Netlify dev server endpoints...');

  // 1. Test Report Generation (gpt-5.5 + dynamic prompt loader)
  try {
    console.log('Testing v2-generate-report (uses gpt-5.5, might take 30-40s)...');
    const res = await fetch('http://localhost:8888/.netlify/functions/v2-generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '《精益创业》',
        author: 'Eric Ries',
        categoryLabel: '战略增长书',
        depthLabel: '标准深度版',
        goal: '快速验证我们的少儿编程产品MVP设想。',
        materials: '精益创业的核心是“构建-衡量-学习”反馈循环。创业公司不要一开始就投入巨资开发完美产品，而是设计最小可行产品(MVP)进入市场进行快速概念测试，并通过反馈进行科学验证或转型(Pivot)。'
      })
    });
    const data = await res.json();
    console.log('v2-generate-report Status:', res.status);
    if (res.status === 200) {
      console.log('Report generated length:', data.report ? data.report.length : 0);
      console.log('Report prefix:', data.report ? data.report.slice(0, 150) + '...' : 'None');
      console.log('Contains JSON block:', data.report ? data.report.includes('{') && data.report.includes('}') : false);
    } else {
      console.error('Report error:', data);
    }
  } catch (err) {
    console.error('v2-generate-report failed:', err);
  }

  // 2. Test Double Debate
  try {
    console.log('Testing v2-double-debate...');
    const res = await fetch('http://localhost:8888/.netlify/functions/v2-double-debate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author1: '彼得·蒂尔',
        author2: '埃里克·莱斯',
        query: '小鹿 Scratch 课程应该追求极致独占壁垒，还是快速迭代 MVP 收集市场反馈？',
        bookTitle: '从0到1 vs 精益创业'
      })
    });
    const data = await res.json();
    console.log('v2-double-debate Status:', res.status);
    if (res.status === 200) {
      console.log('Debate script prefix:', data.debate ? data.debate.slice(0, 200) + '...' : 'None');
    } else {
      console.error('Debate error:', data);
    }
  } catch (err) {
    console.error('v2-double-debate failed:', err);
  }

  // 3. Test Strategy Simulator
  try {
    console.log('Testing v2-strategy-simulator...');
    const res = await fetch('http://localhost:8888/.netlify/functions/v2-strategy-simulator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '《从 0 到 1》',
        scenario: '小鹿决定不进行低价低端扩张，而是只在一个有 100 名核心种子用户的社区建立极致的 AI 教学工具壁垒，获得极高客单价。',
        goal: '追求高净值垄断',
        budget: 50000,
        teamSize: 3
      })
    });
    const data = await res.json();
    console.log('v2-strategy-simulator Status:', res.status);
    if (res.status === 200) {
      console.log('Probability:', data.successProbability);
      console.log('Rules applied:', data.rulesApplied);
      console.log('Projections count:', data.timelineProjections ? data.timelineProjections.length : 0);
      console.log('Bottlenecks count:', data.criticalFailurePoints ? data.criticalFailurePoints.length : 0);
    } else {
      console.error('Simulator error:', data);
    }
  } catch (err) {
    console.error('v2-strategy-simulator failed:', err);
  }

  // 4. Test Roundtable Chat
  try {
    console.log('Testing v2-roundtable-chat...');
    const res = await fetch('http://localhost:8888/.netlify/functions/v2-roundtable-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '《精益创业》',
        authors: '彼得·蒂尔,雷军,埃里克·莱斯',
        messages: [
          { role: 'user', content: '各位大师，如果我们要以 4 个人的极小团队，在一个月内上线一个面向少儿的 AI 伴练软件，应该怎么规划第一步？' }
        ]
      })
    });
    const data = await res.json();
    console.log('v2-roundtable-chat Status:', res.status);
    if (res.status === 200) {
      console.log('Roundtable response:', data.message ? data.message.slice(0, 200) + '...' : 'None');
    } else {
      console.error('Roundtable error:', data);
    }
  } catch (err) {
    console.error('v2-roundtable-chat failed:', err);
  }

  // 5. Test Infographic Generation
  try {
    console.log('Testing v2-generate-infographic (strategy_card)...');
    const res = await fetch('http://localhost:8888/.netlify/functions/v2-generate-infographic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '《精益创业》',
        author: 'Eric Ries',
        categoryLabel: '战略增长书',
        goal: '快速验证我们的少儿编程产品MVP设想。',
        cardType: 'strategy_card'
      })
    });
    const data = await res.json();
    console.log('v2-generate-infographic Status:', res.status);
    if (res.status === 200) {
      console.log('Image type returned:', data.imageUrl ? data.imageUrl.slice(0, 30) + '...' : 'None');
      console.log('Filename:', data.filename);
    } else {
      console.error('Infographic error:', data);
    }
  } catch (err) {
    console.error('v2-generate-infographic failed:', err);
  }
}

run();
