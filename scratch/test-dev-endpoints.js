async function run() {
  console.log('Testing Netlify dev server endpoints...');

  // Test health check
  try {
    const res = await fetch('http://localhost:8888/.netlify/functions/import-weread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'health' })
    });
    const data = await res.json();
    console.log('WeRead Health status:', res.status, data);
  } catch (err) {
    console.error('WeRead Health check failed:', err);
  }

  // Test WeRead search
  try {
    const res = await fetch('http://localhost:8888/.netlify/functions/import-weread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'searchBooks', query: '从0到1', limit: 2 })
    });
    const data = await res.json();
    console.log('WeRead Search status:', res.status, 'Books found:', data.books?.length || 0);
    if (data.books && data.books.length > 0) {
      console.log('First book:', data.books[0]);
    }
  } catch (err) {
    console.error('WeRead Search failed:', err);
  }

  // Test Report Generation
  try {
    console.log('Testing report generation (this might take a few seconds)...');
    const res = await fetch('http://localhost:8888/.netlify/functions/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '《从 0 到 1》',
        author: 'Peter Thiel',
        category: 'strategy',
        categoryLabel: '战略书',
        depth: 'standard',
        depthLabel: '标准版',
        goal: '我想判断这本书对小鹿 AI 编程的产品创新、市场破局有什么帮助。',
        background: 'K12 AI 编程教育创业负责人',
        materials: '1. 从 0 到 1：进步分为水平复制 and 垂直创新。\n2. 竞争会让企业陷入同质化，垄断企业才能拥有长期利润。\n3. 创业公司应该从小市场切入，在细分市场建立主导地位后再扩张。\n4. 好公司通常建立在“秘密”之上，也就是别人还没有看到的非共识真相。\n5. 销售和分发能力常被低估，技术产品也需要设计有效的分发路径。'
      })
    });
    const data = await res.json();
    console.log('Report Generation status:', res.status);
    if (res.status === 200) {
      console.log('Report structure prefix:', data.report ? data.report.slice(0, 200) + '...' : 'Empty report');
      console.log('Report model:', data.model);
      console.log('Chunks:', data.chunks);
    } else {
      console.error('Report generation error:', data);
    }
  } catch (err) {
    console.error('Report generation failed:', err);
  }

  // Test Infographic Generation
  try {
    console.log('Testing infographic generation (this might take a few seconds)...');
    const res = await fetch('http://localhost:8888/.netlify/functions/generate-infographic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '《从 0 到 1》',
        author: 'Peter Thiel',
        categoryLabel: '战略书',
        goal: '我想判断这本书对小鹿 AI 编程的产品创新、市场破局有什么帮助。'
      })
    });
    const data = await res.json();
    console.log('Infographic status:', res.status);
    if (res.status === 200) {
      console.log('Infographic URL length:', data.imageUrl ? data.imageUrl.length : 0);
      console.log('Infographic URL prefix:', data.imageUrl ? data.imageUrl.slice(0, 100) + '...' : 'None');
      console.log('Model used:', data.model);
    } else {
      console.error('Infographic error:', data);
    }
  } catch (err) {
    console.error('Infographic generation failed:', err);
  }
}

run();
