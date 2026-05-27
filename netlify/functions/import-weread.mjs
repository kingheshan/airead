const GATEWAY_URL = process.env.WEREAD_GATEWAY_URL || process.env.WEREAD_GATEWAY || 'https://i.weread.qq.com/api/agent/gateway';
const SKILL_VERSION = process.env.WEREAD_SKILL_VERSION || '1.0.3';
const DEFAULT_TIMEOUT_MS = Number(process.env.WEREAD_SKILL_TIMEOUT_MS || process.env.WEREAD_TIMEOUT_MS || 30000);
const MAX_IMPORT_CHARS = Number(process.env.MAX_WEREAD_IMPORT_CHARS || 60000);
const MAX_ITEMS = Number(process.env.WEREAD_MAX_ITEMS || 180);
const MAX_NOTEBOOK_PAGES = Number(process.env.WEREAD_NOTEBOOK_PAGES || 20);
const MAX_REVIEW_PAGES = Number(process.env.WEREAD_REVIEW_PAGES || 20);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed. Use POST.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const action = clean(body.action || 'health', 60);
  const input = {
    query: clean(body.query || body.keyword || body.title, 240),
    title: clean(body.title, 240),
    author: clean(body.author, 160),
    bookId: clean(body.bookId || body.book_id || body.id, 160),
    limit: clamp(Number(body.limit || body.count || 100), 1, 500),
    includePopular: Boolean(body.includePopular)
  };

  try {
    if (action === 'health') return json(200, await healthPayload());
    if (action === 'searchBooks') return json(200, await searchBooks(input));
    if (action === 'listRecent' || action === 'listNotebooks') return json(200, await listRecentNotebooks(input));
    if (action === 'importShelf') return json(200, await importShelf(input));
    if (action === 'importBook') return json(200, await importBook(input));
    return json(400, { error: `Unsupported WeRead action: ${action}` });
  } catch (error) {
    return json(error.statusCode || 502, {
      status: 'error',
      error: error?.message || 'WeRead gateway call failed.',
      hint: '请检查 WEREAD_API_KEY 是否已配置，格式通常为 wrk-xxxxxxxx。部署在 Netlify 时请放到环境变量，不能放前端。'
    });
  }
}

async function healthPayload() {
  const configured = Boolean(process.env.WEREAD_API_KEY);
  return {
    status: configured ? 'ready' : 'not_configured',
    mode: 'agent-gateway',
    gateway: GATEWAY_URL,
    skillVersion: SKILL_VERSION,
    configured,
    capabilities: ['health', 'searchBooks', 'listRecent', 'listNotebooks', 'importBook', 'importShelf'],
    message: configured
      ? 'WeRead API Key 已配置，可以通过 Agent API Gateway 调用 weread-skills。'
      : '尚未配置 WEREAD_API_KEY。请在 .env 或 Netlify Environment variables 中设置。'
  };
}

async function searchBooks(input) {
  if (!input.query) throw badRequest('请输入要搜索的书名或关键词。');
  const data = await weread('/store/search', {
    keyword: input.query,
    scope: 10,
    count: input.limit
  });
  const books = extractSearchBooks(data).slice(0, input.limit);
  return {
    status: 'ok',
    action: 'searchBooks',
    query: input.query,
    books,
    count: books.length,
    rawMeta: pickMeta(data)
  };
}

async function listRecentNotebooks(input) {
  const target = clamp(Number(input.limit || 100), 1, 500);
  const rawBooks = [];
  let firstPage = null;
  let lastSort;
  let hasMore = false;

  for (let page = 0; page < MAX_NOTEBOOK_PAGES && rawBooks.length < target; page += 1) {
    const params = { count: Math.min(100, target - rawBooks.length) };
    if (lastSort) params.lastSort = lastSort;
    const data = await weread('/user/notebooks', params);
    if (!firstPage) firstPage = data;
    const pageBooks = Array.isArray(data.books) ? data.books : [];
    rawBooks.push(...pageBooks);
    hasMore = Boolean(data.hasMore);
    if (!hasMore) break;
    const tail = pageBooks[pageBooks.length - 1];
    lastSort = tail?.sort;
    if (!lastSort) break;
  }

  const books = extractNotebookBooks({ books: rawBooks }).slice(0, target).sort((a, b) => b.totalNoteCount - a.totalNoteCount);
  return {
    status: 'ok',
    action: 'listNotebooks',
    books,
    count: books.length,
    totalBookCount: numberish(firstPage?.totalBookCount) || books.length,
    totalNoteCount: numberish(firstPage?.totalNoteCount) || books.reduce((sum, book) => sum + book.totalNoteCount, 0),
    hasMore,
    rawMeta: pickMeta(firstPage || {})
  };
}

async function importShelf(input) {
  const data = await weread('/shelf/sync', {});
  const books = extractShelfBooks(data).slice(0, input.limit || 50);
  return {
    status: 'ok',
    action: 'importShelf',
    books,
    count: books.length,
    visibleCount: books.length,
    rawMeta: pickMeta(data)
  };
}

async function importBook(input) {
  let bookId = input.bookId;
  let searchHit = null;
  if (!bookId) {
    const keyword = input.title || input.query;
    if (!keyword) throw badRequest('请输入 bookId，或者输入书名用于搜索。');
    const search = await searchBooks({ ...input, query: keyword, limit: 5 });
    searchHit = search.books[0] || null;
    bookId = searchHit?.bookId || '';
    if (!bookId) throw badRequest(`没有找到书籍：${keyword}`);
  }

  const errors = [];
  const [info, chapterInfo, progress, bookmarkList, mineReviews, popularBookmarks] = await Promise.all([
    optionalWeread('/book/info', { bookId }, errors),
    optionalWeread('/book/chapterinfo', { bookId }, errors),
    optionalWeread('/book/getprogress', { bookId }, errors),
    optionalWeread('/book/bookmarklist', { bookId }, errors),
    listMineReviews(bookId, Math.min(input.limit || 100, 300), errors),
    input.includePopular ? optionalWeread('/book/bestbookmarks', { bookId, chapterUid: 0 }, errors) : Promise.resolve(null)
  ]);

  const book = {
    ...normalizeBook(searchHit || {}),
    ...normalizeBook(info?.book || info?.bookInfo || info || {}),
    bookId
  };
  if (!book.title && input.title) book.title = input.title;
  if (!book.author && input.author) book.author = input.author;

  const chapters = mergeChapters(chapterInfo, bookmarkList);
  const chapterMap = new Map(chapters.map(ch => [String(ch.chapterUid), ch]));
  const highlights = extractHighlights(bookmarkList, chapterMap).slice(0, MAX_ITEMS);
  const reviews = extractMineReviews(mineReviews, chapterMap).slice(0, MAX_ITEMS);
  const popularHighlights = extractPopularHighlights(popularBookmarks, chapterMap, bookId).slice(0, MAX_ITEMS);
  const progressInfo = normalizeProgress(progress);

  const material = buildMarkdownMaterial({ book, progressInfo, chapters, highlights, reviews, popularHighlights, errors });
  return {
    status: 'ok',
    action: 'importBook',
    book,
    progress: progressInfo,
    counts: {
      chapters: chapters.length,
      highlights: highlights.length,
      reviews: reviews.length,
      popularHighlights: popularHighlights.length,
      errors: errors.length
    },
    material: material.slice(0, MAX_IMPORT_CHARS),
    truncated: material.length > MAX_IMPORT_CHARS,
    errors,
    importedAt: new Date().toISOString()
  };
}

async function listMineReviews(bookId, limit, errors) {
  const reviews = [];
  let synckey = 0;
  for (let page = 0; page < MAX_REVIEW_PAGES && reviews.length < limit; page += 1) {
    const params = { bookid: bookId, count: Math.min(20, limit - reviews.length) };
    if (synckey) params.synckey = synckey;
    const data = await optionalWeread('/review/list/mine', params, errors);
    if (!data) break;
    const list = Array.isArray(data.reviews) ? data.reviews : [];
    reviews.push(...list);
    if (!(data.hasMore === 1 || data.hasMore === true)) break;
    const next = Number(data.synckey || 0);
    if (!next || next === synckey) break;
    synckey = next;
  }
  return { reviews };
}

async function optionalWeread(apiName, params, errors) {
  try {
    return await weread(apiName, params);
  } catch (error) {
    errors.push(`${apiName}: ${error.message}`);
    return null;
  }
}

async function weread(apiName, params = {}) {
  const apiKey = process.env.WEREAD_API_KEY;
  if (!apiKey) {
    const error = new Error('WEREAD_API_KEY is not configured.');
    error.statusCode = 500;
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const body = { api_name: apiName, ...params, skill_version: SKILL_VERSION };

  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { text }; }

    if (!response.ok) {
      throw new Error(data?.error || data?.message || data?.text || `WeRead gateway returned HTTP ${response.status}`);
    }
    if (data?.upgrade_info) {
      throw new Error(`weread-skills 需要升级：${data.upgrade_info.message || JSON.stringify(data.upgrade_info)}`);
    }
    if (Number(data?.errcode || 0) !== 0) {
      throw new Error(data?.errmsg || data?.message || `WeRead API errcode=${data.errcode}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function buildMarkdownMaterial({ book, progressInfo, chapters, highlights, reviews, popularHighlights = [], errors }) {
  const lines = [];
  lines.push(`--- 微信读书导入材料 ---`);
  lines.push(`来源：weread-skills / Agent API Gateway`);
  lines.push(`导入时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  if (book.bookId) lines.push(`微信读书 bookId：${book.bookId}`);
  if (book.title) lines.push(`书名：${book.title}`);
  if (book.author) lines.push(`作者：${book.author}`);
  if (book.category) lines.push(`分类：${book.category}`);
  if (book.publisher) lines.push(`出版社：${book.publisher}`);
  if (book.rating) lines.push(`评分：${book.rating}`);
  if (progressInfo.progress !== '') lines.push(`阅读进度：${progressInfo.progress}%`);
  if (progressInfo.readingTimeText) lines.push(`累计阅读时长：${progressInfo.readingTimeText}`);
  if (book.bookId) lines.push(`继续阅读：weread://reading?bId=${book.bookId}`);
  lines.push('');
  lines.push('版权边界：以下内容优先来自用户授权导入的个人划线、笔记、想法、阅读进度和目录线索，仅用于个人学习、评论、研究和业务迁移；不要作为替代原书的完整内容传播。');
  lines.push('');

  if (book.intro) {
    lines.push('## 书籍简介线索');
    lines.push(truncate(book.intro, 900));
    lines.push('');
  }

  if (chapters.length) {
    lines.push('## 目录线索');
    chapters.slice(0, 80).forEach(ch => {
      const indent = '  '.repeat(Math.max(0, Number(ch.level || 1) - 1));
      const word = ch.wordCount ? ` · ${ch.wordCount}字` : '';
      lines.push(`${indent}- ${ch.title || `章节 ${ch.chapterIdx || ch.chapterUid}`}${word}${book.bookId && ch.chapterUid ? ` · weread://reading?bId=${book.bookId}&chapterUid=${ch.chapterUid}` : ''}`);
    });
    lines.push('');
  }

  if (highlights.length) {
    lines.push('## 我的划线 / 高亮');
    highlights.forEach((item, index) => {
      lines.push(`### 划线 ${index + 1}${item.chapterTitle ? `｜${item.chapterTitle}` : ''}`);
      if (item.markText) lines.push(`> ${truncate(item.markText, 900)}`);
      const meta = [];
      if (item.createDate) meta.push(`时间：${item.createDate}`);
      if (item.range) meta.push(`range：${item.range}`);
      if (item.link) meta.push(`位置：${item.link}`);
      if (meta.length) lines.push(meta.join(' · '));
      lines.push('');
    });
  }

  if (reviews.length) {
    lines.push('## 我的想法 / 点评');
    reviews.forEach((item, index) => {
      lines.push(`### 想法 ${index + 1}${item.chapterTitle ? `｜${item.chapterTitle}` : ''}`);
      lines.push(truncate(stripHtml(item.content), 1000));
      const meta = [];
      if (item.createDate) meta.push(`时间：${item.createDate}`);
      if (item.link) meta.push(`位置：${item.link}`);
      if (meta.length) lines.push(meta.join(' · '));
      lines.push('');
    });
  }

  if (popularHighlights.length) {
    lines.push('## 章节热门划线 / 公共线索');
    lines.push('说明：这是微信读书公开热门划线线索，用于辅助理解读者关注点，不等同于我的个人笔记。');
    popularHighlights.forEach((item, index) => {
      lines.push(`### 热门划线 ${index + 1}${item.chapterTitle ? `｜${item.chapterTitle}` : ''}`);
      if (item.markText) lines.push(`> ${truncate(item.markText, 700)}`);
      const meta = [];
      if (item.totalCount) meta.push(`${item.totalCount} 人划线`);
      if (item.range) meta.push(`range：${item.range}`);
      if (item.link) meta.push(`位置：${item.link}`);
      if (meta.length) lines.push(meta.join(' · '));
      lines.push('');
    });
  }

  if (!highlights.length && !reviews.length) {
    lines.push('## 导入结果提示');
    lines.push('当前没有拿到单本书的划线或想法内容。仍可基于书籍信息、目录和阅读进度生成拆书报告；若要更准，请在微信读书中添加划线/笔记后再导入。');
    lines.push('');
  }

  if (errors.length) {
    lines.push('## 导入过程中的非致命错误');
    errors.forEach(err => lines.push(`- ${err}`));
    lines.push('');
  }

  return lines.join('\n').slice(0, MAX_IMPORT_CHARS + 1000);
}

function extractSearchBooks(data = {}) {
  const groups = [];
  if (Array.isArray(data.results)) groups.push(...data.results);
  if (Array.isArray(data.books)) groups.push({ books: data.books });
  if (Array.isArray(data.bookList)) groups.push({ books: data.bookList });
  const items = [];
  for (const group of groups) {
    const arr = Array.isArray(group.books) ? group.books : Array.isArray(group.items) ? group.items : [];
    for (const item of arr) {
      const info = item.bookInfo || item.book || item.book_info || item;
      const book = normalizeBook(info);
      if (book.bookId || book.title) {
        items.push({
          ...book,
          searchIdx: item.searchIdx ?? item.idx ?? '',
          readingCount: item.readingCount ?? info.readingCount ?? '',
          groupTitle: group.title || '',
          scope: group.scope ?? ''
        });
      }
    }
  }
  return dedupeBooks(items);
}

function extractNotebookBooks(data = {}) {
  const arr = Array.isArray(data.books) ? data.books : [];
  return arr.map(item => {
    const info = item.book || item.bookInfo || item;
    const book = normalizeBook(info);
    const reviewCount = numberish(item.reviewCount);
    const noteCount = numberish(item.noteCount);
    const bookmarkCount = numberish(item.bookmarkCount);
    return {
      ...book,
      reviewCount,
      noteCount,
      bookmarkCount,
      totalNoteCount: reviewCount + noteCount + bookmarkCount,
      readingProgress: item.readingProgress ?? '',
      markedStatus: item.markedStatus ?? '',
      sort: item.sort ?? ''
    };
  }).filter(x => x.bookId || x.title);
}

function extractShelfBooks(data = {}) {
  const books = Array.isArray(data.books) ? data.books.map(normalizeBook) : [];
  const albums = Array.isArray(data.albums) ? data.albums.map(item => {
    const info = item.albumInfo || item;
    return {
      bookId: clean(info.albumId || info.id, 120),
      title: clean(info.name || info.title, 240),
      author: clean(info.authorName || info.author, 160),
      cover: clean(info.cover, 500),
      category: '微信听书 / 专辑',
      isAlbum: true
    };
  }) : [];
  return dedupeBooks([...books, ...albums]);
}

function normalizeBook(input = {}) {
  return {
    bookId: clean(input.bookId || input.book_id || input.id || input.bookIdStr || '', 160),
    title: clean(input.title || input.name || input.bookName || '', 240),
    author: clean(input.author || input.authorName || input.writer || '', 160),
    cover: clean(input.cover || input.coverUrl || input.cover_url || '', 500),
    intro: cleanLong(input.intro || input.description || input.summary || '', 1600),
    category: clean(input.category || input.className || input.type || '', 120),
    publisher: clean(input.publisher || '', 160),
    publishTime: clean(input.publishTime || '', 80),
    isbn: clean(input.isbn || '', 80),
    wordCount: input.wordCount ?? '',
    rating: input.newRating ?? input.rating ?? input.newRatingDetail?.title ?? '',
    ratingCount: input.newRatingCount ?? input.ratingCount ?? ''
  };
}

function mergeChapters(...sources) {
  const map = new Map();
  for (const source of sources) {
    const arr = Array.isArray(source?.chapters) ? source.chapters : [];
    for (const ch of arr) {
      const chapterUid = clean(ch.chapterUid || ch.uid || ch.id, 120);
      if (!chapterUid) continue;
      map.set(chapterUid, {
        chapterUid,
        chapterIdx: ch.chapterIdx ?? ch.idx ?? '',
        title: clean(ch.title || ch.chapterTitle || ch.name, 240),
        level: ch.level ?? 1,
        wordCount: ch.wordCount ?? '',
        paid: ch.paid ?? '',
        price: ch.price ?? ''
      });
    }
  }
  return [...map.values()].sort((a, b) => Number(a.chapterIdx || 0) - Number(b.chapterIdx || 0));
}

function extractHighlights(data, chapterMap) {
  const arr = Array.isArray(data?.updated) ? data.updated : Array.isArray(data?.bookmarks) ? data.bookmarks : [];
  return arr.map(item => {
    const chapterUid = clean(item.chapterUid || item.chapterId || '', 120);
    const range = clean(item.range || '', 120);
    const bookId = clean(item.bookId || data?.book?.bookId || '', 160);
    return {
      bookmarkId: clean(item.bookmarkId || item.id, 120),
      bookId,
      chapterUid,
      chapterTitle: chapterMap.get(String(chapterUid))?.title || clean(item.chapterTitle || item.chapterName, 240),
      markText: cleanLong(item.markText || item.text || item.content || '', 2000),
      createDate: dateFromUnix(item.createTime || item.createdAt || item.time),
      range,
      colorStyle: item.colorStyle ?? '',
      link: buildBestBookmarkLink(bookId, chapterUid, range)
    };
  }).filter(x => x.markText);
}

function extractPopularHighlights(data, chapterMap, fallbackBookId = '') {
  const arr = Array.isArray(data?.items) ? data.items
    : Array.isArray(data?.bookmarks) ? data.bookmarks
    : Array.isArray(data?.updated) ? data.updated
    : Array.isArray(data?.bestBookMarks) ? data.bestBookMarks
    : Array.isArray(data?.data) ? data.data
    : [];
  return arr.map(item => {
    const source = item.bookmark || item.bestBookmark || item;
    const chapterUid = clean(source.chapterUid || item.chapterUid || source.chapterId || '', 120);
    const range = clean(source.range || item.range || '', 120);
    const bookId = clean(source.bookId || item.bookId || fallbackBookId, 160);
    return {
      bookId,
      chapterUid,
      chapterTitle: chapterMap.get(String(chapterUid))?.title || clean(source.chapterTitle || source.chapterName || item.chapterTitle || '', 240),
      markText: cleanLong(source.markText || source.text || source.content || item.markText || item.text || '', 2000),
      range,
      totalCount: numberish(source.totalCount || source.count || source.markCount || item.totalCount || item.count),
      link: buildBestBookmarkLink(bookId, chapterUid, range)
    };
  }).filter(x => x.markText);
}

function extractMineReviews(data, chapterMap) {
  const arr = Array.isArray(data?.reviews) ? data.reviews : Array.isArray(data?.updated) ? data.updated : Array.isArray(data?.items) ? data.items : [];
  return arr.map(item => {
    const r = item.review?.review || item.review || item;
    const book = r.book || item.book || {};
    const bookId = clean(r.bookId || book.bookId || '', 160);
    const chapterUid = clean(r.chapterUid || r.chapterId || '', 120);
    const range = clean(r.range || '', 120);
    return {
      reviewId: clean(r.reviewId || item.reviewId || r.id || item.id, 120),
      bookId,
      chapterUid,
      chapterTitle: chapterMap.get(String(chapterUid))?.title || clean(r.chapterName || r.chapterTitle || '', 240),
      content: cleanLong(r.content || r.htmlContent || item.content || item.htmlContent || '', 2000),
      createDate: dateFromUnix(r.createTime || item.createTime || r.createdAt || item.createdAt),
      range,
      link: buildBestBookmarkLink(bookId, chapterUid, range)
    };
  }).filter(x => x.content);
}

function normalizeProgress(data = {}) {
  const book = data?.book || data || {};
  const seconds = numberish(book.recordReadingTime || data?.recordReadingTime);
  return {
    progress: book.progress ?? data?.progress ?? '',
    chapterUid: book.chapterUid || '',
    updateDate: dateFromUnix(book.updateTime || data?.updateTime),
    readingSeconds: seconds,
    readingTimeText: seconds ? secondsToText(seconds) : '',
    finishDate: dateFromUnix(book.finishTime || data?.finishTime),
    isStartReading: book.isStartReading ?? data?.isStartReading ?? ''
  };
}

function buildBestBookmarkLink(bookId, chapterUid, range) {
  if (!bookId || !chapterUid || !range || !String(range).includes('-')) return '';
  const [rangeStart, rangeEnd] = String(range).split('-');
  if (!rangeStart || !rangeEnd) return '';
  return `weread://bestbookmark?bookId=${encodeURIComponent(bookId)}&chapterUid=${encodeURIComponent(chapterUid)}&rangeStart=${encodeURIComponent(rangeStart)}&rangeEnd=${encodeURIComponent(rangeEnd)}`;
}

function dedupeBooks(books) {
  const seen = new Set();
  const result = [];
  for (const book of books) {
    const key = book.bookId || `${book.title}|${book.author}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(book);
  }
  return result;
}

function pickMeta(data = {}) {
  return {
    hasMore: data.hasMore ?? data.reviewsHasMore ?? '',
    synckey: data.synckey ?? '',
    total: data.totalBookCount ?? data.totalNoteCount ?? data.scopeCount ?? '',
    timestamp: data.timestamp ?? ''
  };
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function truncate(value, max) {
  const text = cleanLong(value, max + 100);
  return text.length > max ? `${text.slice(0, max)}……` : text;
}

function dateFromUnix(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  const ms = num > 100000000000 ? num : num * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function secondsToText(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h && m) return `${h}小时${m}分钟`;
  if (h) return `${h}小时`;
  return `${m}分钟`;
}

function numberish(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clean(value, max = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanLong(value, max = 3000) {
  return String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  };
}
