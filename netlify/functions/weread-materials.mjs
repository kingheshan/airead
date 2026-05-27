import { normalizeWereadPayload } from '../../lib/weread-adapter.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  try {
    if (!body.raw && !body.text && process.env.WEREAD_SKILL_ENDPOINT) {
      const imported = await importFromWereadBridge(body);
      return json(200, normalizeWereadPayload({ data: imported, ...body }));
    }

    const result = normalizeWereadPayload(body);
    if (result.itemCount === 0) {
      return json(400, { error: '没有解析到有效的微信读书材料。请粘贴 weread-skills 导出的 JSON/文本，或检查导入内容。' });
    }
    return json(200, result);
  } catch (error) {
    return json(502, { error: error?.message || '微信读书材料导入失败。' });
  }
}

async function importFromWereadBridge(body) {
  const endpoint = process.env.WEREAD_SKILL_ENDPOINT;
  const token = process.env.WEREAD_SKILL_TOKEN;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      bookId: body.bookId || '',
      bookUrl: body.bookUrl || '',
      title: body.title || '',
      includeHighlights: true,
      includeReviews: true,
      includeChapters: true
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'WEREAD_SKILL_ENDPOINT 返回失败。');
  }
  return data;
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  };
}
