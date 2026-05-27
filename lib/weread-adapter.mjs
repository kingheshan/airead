const MAX_ITEMS = Number(process.env.WEREAD_MAX_ITEMS || 400);
const MAX_TEXT_CHARS = Number(process.env.WEREAD_MAX_TEXT_CHARS || 90000);

const TITLE_KEYS = ['title', 'bookTitle', 'name'];
const AUTHOR_KEYS = ['author', 'bookAuthor', 'writer'];
const TEXT_KEYS = ['text', 'content', 'markText', 'abstract', 'note', 'review', 'summary', 'chapterAbstract', 'bookmark', 'annotation'];
const CHAPTER_KEYS = ['chapterTitle', 'chapterName', 'chapter', 'range', 'section'];
const TIME_KEYS = ['createTime', 'createdAt', 'time', 'date', 'updatedAt'];

export function normalizeWereadPayload(input = {}) {
  const raw = String(input.raw || input.text || '').trim();
  const explicit = {
    title: clean(input.title || input.bookTitle || '', 160),
    author: clean(input.author || input.bookAuthor || '', 160),
    bookId: clean(input.bookId || '', 160),
    bookUrl: clean(input.bookUrl || '', 500)
  };

  let parsed = null;
  let parseMode = 'text';
  if (raw) {
    try {
      parsed = JSON.parse(raw);
      parseMode = 'json';
    } catch (_) {
      parsed = null;
    }
  } else if (input.data && typeof input.data === 'object') {
    parsed = input.data;
    parseMode = 'json';
  }

  if (parsed) {
    const title = explicit.title || findFirstValue(parsed, TITLE_KEYS);
    const author = explicit.author || findFirstValue(parsed, AUTHOR_KEYS);
    const bookId = explicit.bookId || clean(findFirstValue(parsed, ['bookId', 'book_id', 'id']), 160);
    const bookUrl = explicit.bookUrl || clean(findFirstValue(parsed, ['bookUrl', 'url', 'href']), 500);
    const items = collectTextItems(parsed).slice(0, MAX_ITEMS);
    const materials = buildMaterials({ title, author, bookId, bookUrl, items, rawText: '', parseMode });
    return {
      title,
      author,
      bookId,
      bookUrl,
      parseMode,
      itemCount: items.length,
      materials,
      truncated: materials.length >= MAX_TEXT_CHARS
    };
  }

  const lines = raw ? raw.split(/\r?\n/).map(x => x.trim()).filter(Boolean) : [];
  const title = explicit.title || guessTitleFromText(lines);
  const author = explicit.author || '';
  const items = lines.map((text, idx) => ({ index: idx + 1, text })).filter(x => x.text.length >= 2).slice(0, MAX_ITEMS);
  const materials = buildMaterials({
    title,
    author,
    bookId: explicit.bookId,
    bookUrl: explicit.bookUrl,
    items,
    rawText: raw,
    parseMode
  });
  return {
    title,
    author,
    bookId: explicit.bookId,
    bookUrl: explicit.bookUrl,
    parseMode,
    itemCount: items.length,
    materials,
    truncated: materials.length >= MAX_TEXT_CHARS
  };
}

export function buildMaterialsFromWeread(data) {
  return normalizeWereadPayload({ data }).materials;
}

function buildMaterials({ title, author, bookId, bookUrl, items, rawText, parseMode }) {
  const header = [
    '--- 来自微信读书 weread-skills 的材料 ---',
    title ? `书名：${title}` : '',
    author ? `作者：${author}` : '',
    bookId ? `微信读书 bookId：${bookId}` : '',
    bookUrl ? `微信读书链接：${bookUrl}` : '',
    `解析方式：${parseMode === 'json' ? 'JSON 结构化解析' : '文本行解析'}`,
    '说明：以下内容来自用户授权导入的微信读书划线/笔记/想法/章节摘要，用于学习分析和业务迁移，不应替代原书。',
    ''
  ].filter(Boolean).join('\n');

  const body = items.length
    ? items.map(item => formatItem(item)).join('\n\n')
    : rawText;

  return `${header}\n${body}`.slice(0, MAX_TEXT_CHARS);
}

function formatItem(item) {
  const parts = [];
  parts.push(`【${item.index || '?'}】${item.chapter ? `章节：${item.chapter}` : '读书材料'}`);
  if (item.time) parts.push(`时间：${item.time}`);
  if (item.text) parts.push(`内容：${item.text}`);
  if (item.note && item.note !== item.text) parts.push(`笔记：${item.note}`);
  return parts.join('\n');
}

function collectTextItems(root) {
  const items = [];
  const seen = new Set();

  function visit(node, ctx = {}, depth = 0) {
    if (items.length >= MAX_ITEMS || depth > 8 || node == null) return;

    if (Array.isArray(node)) {
      node.forEach((child, i) => visit(child, { ...ctx, indexHint: i + 1 }, depth + 1));
      return;
    }

    if (typeof node === 'string') {
      const text = cleanLong(node);
      if (isUsefulText(text)) addItem({ text, chapter: ctx.chapter, time: ctx.time });
      return;
    }

    if (typeof node !== 'object') return;

    const chapter = clean(pickValue(node, CHAPTER_KEYS) || ctx.chapter || '', 220);
    const time = clean(pickValue(node, TIME_KEYS) || ctx.time || '', 120);
    const directTexts = TEXT_KEYS.map(key => cleanLong(node[key])).filter(isUsefulText);
    const noteText = cleanLong(node.noteText || node.noteContent || node.reviewContent || node.comment);

    for (const text of directTexts) {
      addItem({ text, note: isUsefulText(noteText) ? noteText : '', chapter, time });
    }

    for (const [key, value] of Object.entries(node)) {
      if (value == null) continue;
      if (TEXT_KEYS.includes(key) && typeof value === 'string') continue;
      if (key.toLowerCase().includes('url') || key.toLowerCase().includes('avatar')) continue;
      visit(value, { chapter, time }, depth + 1);
    }
  }

  function addItem(item) {
    const fingerprint = `${item.chapter || ''}|${item.text || ''}`.slice(0, 600);
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    items.push({ ...item, index: items.length + 1 });
  }

  visit(root);
  return items;
}

function findFirstValue(root, keys) {
  let found = '';
  function visit(node, depth = 0) {
    if (found || depth > 6 || node == null) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, depth + 1);
      return;
    }
    if (typeof node !== 'object') return;
    const direct = pickValue(node, keys);
    if (direct) {
      found = clean(direct, 300);
      return;
    }
    for (const value of Object.values(node)) visit(value, depth + 1);
  }
  visit(root);
  return found;
}

function pickValue(obj, keys) {
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null) {
      if (typeof obj[key] === 'string' || typeof obj[key] === 'number') return String(obj[key]);
    }
  }
  return '';
}

function guessTitleFromText(lines) {
  const first = lines.find(x => /^书名[:：]/.test(x)) || '';
  return clean(first.replace(/^书名[:：]\s*/, ''), 160);
}

function isUsefulText(text) {
  if (!text) return false;
  if (text.length < 6) return false;
  if (/^https?:\/\//i.test(text)) return false;
  return true;
}

function clean(value, max = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanLong(value) {
  return String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
}
