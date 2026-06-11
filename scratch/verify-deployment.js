// Use global fetch (Node.js 18+)

async function verify() {
  const baseUrl = 'https://airead-qmdpvrfp.edgeone.cool';
  const queryAuth = 'eo_token=14b50b329c81110ad3bd3036b3d7c71d&eo_time=1781150770';
  
  function getUrl(path) {
    return `${baseUrl}${path}?${queryAuth}`;
  }

  console.log(`Starting live EdgeOne deployment verification on: ${baseUrl}\n`);

  // 1. Test Podcast Fallback Endpoint
  try {
    console.log('Testing v2-generate-podcast endpoint...');
    const res = await fetch(getUrl('/.netlify/functions/v2-generate-podcast'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '《精益创业》',
        author: 'Eric Ries',
        goal: '快速验证少儿编程产品MVP',
        report: '这是一篇精益创业的分析报告。核心观点包括MVP测试和反馈循环。'
      })
    });
    
    // Note: The EdgeOne adapter uses streaming responses, so we might need to handle it accordingly,
    // but the adapter.js returns the JSON stringified once the handler completes. Let's parse the JSON.
    const text = await res.text();
    console.log('Podcast response status:', res.status);
    
    // Clean potential whitespace/heartbeats from stream
    const jsonStr = text.trim();
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      console.log('Raw response stream:', text.slice(0, 500) + '...');
    }

    if (data) {
      console.log('Podcast result structure:');
      console.log('- has audioUrl:', !!data.audioUrl);
      console.log('- isSilentFallback:', data.isSilentFallback);
      console.log('- script preview:', data.script ? data.script.slice(0, 100) + '...' : 'None');
    }
  } catch (err) {
    console.error('v2-generate-podcast verification failed:', err);
  }

  console.log('\n----------------------------------------\n');

  // 2. Test Infographic Endpoint
  try {
    console.log('Testing v2-generate-infographic endpoint (forces OpenAI DALL-E)...');
    const res = await fetch(getUrl('/.netlify/functions/v2-generate-infographic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '《从0到1》',
        author: '彼得·蒂尔',
        categoryLabel: '战略商业',
        goal: '快速建立核心种子用户垄断壁垒',
        cardType: 'strategy_card'
      })
    });

    const text = await res.text();
    console.log('Infographic response status:', res.status);
    
    const jsonStr = text.trim();
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      console.log('Raw response stream:', text.slice(0, 500) + '...');
    }

    if (data) {
      if (res.status === 200) {
        console.log('Infographic Success!');
        console.log('- imageUrl length:', data.imageUrl ? data.imageUrl.length : 0);
        console.log('- model used:', data.model);
        console.log('- filename:', data.filename);
      } else {
        console.error('Infographic error data:', data);
      }
    }
  } catch (err) {
    console.error('v2-generate-infographic verification failed:', err);
  }
}

verify();
