import OpenAI from 'openai';

export function getOpenAIClient() {
  const key = (process.env.OPENAI_API_KEY || '').trim();
  
  let baseURL = undefined;
  let isDeepSeek = false;
  
  // Auto-detect DeepSeek API key format (starts with sk- and is a 32-character hex key)
  if (key.startsWith('sk-') && key.length === 35 && /^[0-9a-fA-F]+$/.test(key.slice(3))) {
    isDeepSeek = true;
    baseURL = 'https://api.deepseek.com/v1';
  } else if (process.env.OPENAI_BASE_URL && process.env.OPENAI_BASE_URL.includes('deepseek')) {
    isDeepSeek = true;
    baseURL = process.env.OPENAI_BASE_URL;
  } else if (process.env.OPENAI_BASE_URL) {
    baseURL = process.env.OPENAI_BASE_URL;
  }

  const client = new OpenAI({
    apiKey: key,
    ...(baseURL ? { baseURL } : {})
  });

  // Intercept client.images.generate for DeepSeek since DeepSeek doesn't support image generation
  if (!client.images) {
    client.images = {};
  }
  const originalImagesGenerate = client.images.generate;
  client.images.generate = async function (params, options) {
    if (isDeepSeek) {
      console.log(`[DeepSeek Wrapper] Intercepting images.generate and returning SVG placeholder card...`);
      const promptStr = params.prompt || '';
      const titleMatch = promptStr.match(/Book Title:\s*"(.*?)"/) || promptStr.match(/书名：\s*(.*)/);
      const title = titleMatch ? titleMatch[1] : '小鹿 AI 拆书';
      
      const authorMatch = promptStr.match(/by\s*"(.*?)"/) || promptStr.match(/作者：\s*(.*)/);
      const author = authorMatch ? authorMatch[1] : '首席战略官';
      
      const categoryMatch = promptStr.match(/Category:\s*(.*?)\./) || promptStr.match(/类型：\s*(.*)/);
      const category = categoryMatch ? categoryMatch[1] : '战略商业';
      
      const goalMatch = promptStr.match(/Reading Goal:\s*(.*?)\./) || promptStr.match(/目的：\s*(.*)/);
      const goal = goalMatch ? goalMatch[1] : '深入学习';

      // Generate a premium dark SVG card
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
          <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0f172a" />
              <stop offset="100%" stop-color="#020617" />
            </linearGradient>
            <linearGradient id="neonCyan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#00f2fe" />
              <stop offset="100%" stop-color="#4facfe" />
            </linearGradient>
            <linearGradient id="neonPurple" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#b152ff" />
              <stop offset="100%" stop-color="#7000ff" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="15" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          <rect width="800" height="800" fill="url(#bgGrad)" rx="24"/>
          <rect x="20" y="20" width="760" height="760" fill="none" stroke="#1e293b" stroke-width="2" rx="20"/>
          <rect x="20" y="20" width="760" height="760" fill="none" stroke="url(#neonCyan)" stroke-width="1.5" stroke-opacity="0.3" rx="20"/>
          
          <path d="M 40 100 L 760 100" stroke="#1e293b" stroke-width="1"/>
          <path d="M 40 700 L 760 700" stroke="#1e293b" stroke-width="1"/>
          <path d="M 250 100 L 250 700" stroke="#1e293b" stroke-width="1"/>
          
          <g filter="url(#glow)" opacity="0.15">
            <circle cx="500" cy="400" r="120" fill="none" stroke="url(#neonCyan)" stroke-width="2"/>
            <circle cx="500" cy="400" r="80" fill="none" stroke="url(#neonPurple)" stroke-width="1"/>
            <line x1="300" y1="200" x2="500" y2="400" stroke="#00f2fe" stroke-width="2"/>
            <line x1="650" y1="250" x2="500" y2="400" stroke="#b152ff" stroke-width="2"/>
            <line x1="580" y1="580" x2="500" y2="400" stroke="#00f2fe" stroke-width="2"/>
            <circle cx="300" cy="200" r="10" fill="#00f2fe"/>
            <circle cx="650" cy="250" r="8" fill="#b152ff"/>
            <circle cx="580" cy="580" r="12" fill="#00f2fe"/>
          </g>

          <text x="50" y="65" font-family="sans-serif" font-weight="800" font-size="20" fill="url(#neonCyan)" letter-spacing="1">🦉 小鹿 AI 拆书工坊 V2.0</text>
          <text x="750" y="65" font-family="sans-serif" font-weight="600" font-size="12" fill="#64748b" text-anchor="end" letter-spacing="0.5">CHIEF STRATEGIC OFFICER INTERACTIVE PLATFORM</text>
          
          <text x="50" y="160" font-family="sans-serif" font-weight="bold" font-size="12" fill="#64748b" letter-spacing="1">BOOK KNOWLEDGE BASE</text>
          <text x="50" y="220" font-family="sans-serif" font-weight="800" font-size="28" fill="#ffffff">${title}</text>
          <text x="50" y="260" font-family="sans-serif" font-weight="bold" font-size="14" fill="url(#neonCyan)">作者: ${author}</text>
          
          <rect x="50" y="285" width="160" height="28" fill="rgba(0, 242, 254, 0.1)" stroke="url(#neonCyan)" stroke-width="1" rx="6"/>
          <text x="130" y="303" font-family="sans-serif" font-weight="bold" font-size="12" fill="#00f2fe" text-anchor="middle">${category}</text>
          
          <text x="50" y="360" font-family="sans-serif" font-weight="bold" font-size="12" fill="#64748b" letter-spacing="1">STRATEGIC GOAL</text>
          <foreignObject x="50" y="380" width="180" height="280">
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: sans-serif; font-size: 13px; line-height: 1.6; color: #94a3b8; font-weight: 500;">
              ${goal}
            </div>
          </foreignObject>

          <g transform="translate(280, 130)">
            <rect width="470" height="520" fill="rgba(255, 255, 255, 0.01)" stroke="#1e293b" stroke-width="1" rx="12"/>
            
            <text x="30" y="40" font-family="sans-serif" font-weight="bold" font-size="12" fill="#64748b" letter-spacing="1">CORE EXECUTION FRAMEWORK</text>
            <text x="30" y="80" font-family="sans-serif" font-weight="800" font-size="22" fill="#ffffff">CEO 战略认知操作系统</text>
            
            <circle cx="45" cy="150" r="15" fill="rgba(0, 242, 254, 0.15)" stroke="url(#neonCyan)" stroke-width="1.5"/>
            <text x="45" y="155" font-family="sans-serif" font-weight="bold" font-size="12" fill="#00f2fe" text-anchor="middle">1</text>
            <text x="75" y="145" font-family="sans-serif" font-weight="bold" font-size="15" fill="#ffffff">非共识商业机会识别</text>
            <text x="75" y="165" font-family="sans-serif" font-size="12" fill="#94a3b8">寻找行业空白壁垒，建立10倍体验垄断</text>
            
            <circle cx="45" cy="240" r="15" fill="rgba(177, 82, 255, 0.15)" stroke="url(#neonPurple)" stroke-width="1.5"/>
            <text x="45" y="245" font-family="sans-serif" font-weight="bold" font-size="12" fill="#b152ff" text-anchor="middle">2</text>
            <text x="75" y="235" font-family="sans-serif" font-weight="bold" font-size="15" fill="#ffffff">最小可行性验证 (MVP)</text>
            <text x="75" y="255" font-family="sans-serif" font-size="12" fill="#94a3b8">快速投放市场，闭环“构建-衡量-学习”反馈</text>

            <circle cx="45" cy="330" r="15" fill="rgba(0, 242, 254, 0.15)" stroke="url(#neonCyan)" stroke-width="1.5"/>
            <text x="45" y="335" font-family="sans-serif" font-weight="bold" font-size="12" fill="#00f2fe" text-anchor="middle">3</text>
            <text x="75" y="325" font-family="sans-serif" font-weight="bold" font-size="15" fill="#ffffff">反向对抗仿真推演</text>
            <text x="75" y="345" font-family="sans-serif" font-size="12" fill="#94a3b8">挑战底层核心假设，建立多重防线机制</text>

            <line x1="45" y1="165" x2="45" y2="225" stroke="#1e293b" stroke-width="2" stroke-dasharray="4"/>
            <line x1="45" y1="255" x2="45" y2="315" stroke="#1e293b" stroke-width="2" stroke-dasharray="4"/>

            <path d="M 400 450 C 400 420, 420 400, 450 400" fill="none" stroke="url(#neonCyan)" stroke-width="2" opacity="0.4"/>
            <circle cx="450" cy="400" r="3" fill="#00f2fe"/>
          </g>

          <text x="50" y="745" font-family="sans-serif" font-size="11" fill="#475569">© 2026 小鹿 AI 拆书工坊 V2.0. All rights reserved.</text>
          <text x="750" y="745" font-family="sans-serif" font-size="11" fill="#475569" text-anchor="end">DECISION OS • POWERED BY DEEPSEEK</text>
        </svg>
      `;

      const b64 = Buffer.from(svg).toString('base64');
      const dataUri = `data:image/svg+xml;base64,${b64}`;
      return {
        data: [{
          b64_json: b64,
          url: dataUri
        }]
      };
    }
    
    if (originalImagesGenerate) {
      return originalImagesGenerate.call(client.images, params, options);
    }
    throw new Error('Images API not supported on this endpoint.');
  };

  // Ensure client.responses exists
  if (!client.responses) {
    client.responses = {};
  }

  // Intercept and wrap responses.create to use standard chat.completions.create under the hood
  client.responses.create = async function (params, options) {
    let model = params.model || 'gpt-4o-mini';
    const instructions = params.instructions;
    const input = params.input;
    const max_output_tokens = params.max_output_tokens;

    // Apply model mapping for DeepSeek
    if (isDeepSeek) {
      if (model.startsWith('o1') || model.startsWith('o3') || model.includes('reason') || model.includes('5.5')) {
        model = 'deepseek-reasoner';
      } else {
        model = 'deepseek-chat';
      }
      console.log(`[DeepSeek Wrapper] Mapped model to: ${model}`);
    }

    const messages = [];
    if (instructions) {
      messages.push({ role: 'system', content: instructions });
    }
    if (input) {
      messages.push({ role: 'user', content: input });
    }

    const chatParams = {
      model: model,
      messages: messages,
      ...(max_output_tokens ? { max_tokens: max_output_tokens } : {}),
      ...(params.reasoning && !isDeepSeek ? { reasoning: params.reasoning } : {})
    };

    console.log(`[OpenAI Wrapper] Translating responses.create to chat.completions.create (Model: ${model}, BaseURL: ${baseURL || 'Default OpenAI'})`);

    const chatCompletion = await client.chat.completions.create(chatParams, options);

    // Return the response object matching the Responses API interface
    return {
      output_text: chatCompletion.choices?.[0]?.message?.content || '',
      raw: chatCompletion
    };
  };

  return client;
}
