// Server-side library storage backed by SQLite (better-sqlite3).
// Available on the self-hosted VM deployment; on serverless platforms
// (Netlify/EdgeOne) the driver import fails and we report {available:false}
// so the frontend keeps using localStorage.
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.XIAOLU_DB_PATH || path.resolve(__dirname, '../../data/xiaolu.db');

let db = null;
let driverUnavailable = false;

async function getDb() {
  if (db) return db;
  if (driverUnavailable) return null;
  try {
    const { default: Database } = await import('better-sqlite3');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT DEFAULT '',
        category TEXT DEFAULT 'strategy',
        depth TEXT DEFAULT 'deep',
        goal TEXT DEFAULT '',
        background TEXT DEFAULT '',
        materials TEXT DEFAULT '',
        report TEXT DEFAULT '',
        chunks_json TEXT DEFAULT '[]',
        parsed_json TEXT,
        skill_markdown TEXT DEFAULT '',
        images_json TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS images (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_records_title ON records(title, author);
    `);
    return db;
  } catch (e) {
    console.warn('[library-db] sqlite driver unavailable:', e.message);
    driverUnavailable = true;
    return null;
  }
}

function rowToRecord(row) {
  const parse = (s, fallback) => {
    try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
  };
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    category: row.category,
    depth: row.depth,
    goal: row.goal,
    background: row.background,
    materials: row.materials,
    report: row.report,
    chunks: parse(row.chunks_json, []),
    parsed_json: parse(row.parsed_json, null),
    skill_markdown: row.skill_markdown,
    images_json: parse(row.images_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

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
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const action = body.action || 'health';
  const database = await getDb();

  if (!database) {
    return json(200, { available: false, reason: 'sqlite driver not available on this platform' });
  }

  try {
    switch (action) {
      case 'health': {
        const count = database.prepare('SELECT COUNT(*) AS c FROM records').get().c;
        return json(200, { available: true, records: count, dbPath: path.basename(DB_PATH) });
      }

      case 'list': {
        const rows = database.prepare('SELECT * FROM records ORDER BY updated_at DESC LIMIT 500').all();
        return json(200, { available: true, records: rows.map(rowToRecord) });
      }

      case 'save': {
        const r = body.record || {};
        if (!r.id || !r.title) {
          return json(400, { error: 'record.id and record.title are required.' });
        }
        const now = Date.now();
        database.prepare(`
          INSERT INTO records (id, title, author, category, depth, goal, background, materials,
                               report, chunks_json, parsed_json, skill_markdown, images_json,
                               created_at, updated_at)
          VALUES (@id, @title, @author, @category, @depth, @goal, @background, @materials,
                  @report, @chunks_json, @parsed_json, @skill_markdown, @images_json,
                  @created_at, @updated_at)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, author=excluded.author, category=excluded.category,
            depth=excluded.depth, goal=excluded.goal, background=excluded.background,
            materials=excluded.materials, report=excluded.report, chunks_json=excluded.chunks_json,
            parsed_json=excluded.parsed_json, skill_markdown=excluded.skill_markdown,
            images_json=excluded.images_json, updated_at=excluded.updated_at
        `).run({
          id: String(r.id),
          title: String(r.title).slice(0, 300),
          author: String(r.author || ''),
          category: String(r.category || 'strategy'),
          depth: String(r.depth || 'deep'),
          goal: String(r.goal || ''),
          background: String(r.background || ''),
          materials: String(r.materials || ''),
          report: String(r.report || ''),
          chunks_json: JSON.stringify(r.chunks || []),
          parsed_json: r.parsed_json ? JSON.stringify(r.parsed_json) : null,
          skill_markdown: String(r.skill_markdown || ''),
          images_json: JSON.stringify(r.images_json || {}),
          created_at: Number(r.createdAt) || now,
          updated_at: now
        });
        return json(200, { available: true, saved: r.id });
      }

      case 'delete': {
        if (!body.id) return json(400, { error: 'id is required.' });
        database.prepare('DELETE FROM records WHERE id = ?').run(String(body.id));
        return json(200, { available: true, deleted: body.id });
      }

      case 'save-image': {
        const { key, data } = body;
        if (!key || !data || !String(data).startsWith('data:')) {
          return json(400, { error: 'key and data-URI data are required.' });
        }
        database.prepare(`
          INSERT INTO images (key, data, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at
        `).run(String(key).slice(0, 500), String(data), Date.now());
        return json(200, { available: true, saved: key });
      }

      case 'get-image': {
        if (!body.key) return json(400, { error: 'key is required.' });
        const row = database.prepare('SELECT data FROM images WHERE key = ?').get(String(body.key));
        return json(200, { available: true, data: row ? row.data : null });
      }

      default:
        return json(400, { error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error('[library-db] action failed:', action, e);
    return json(500, { error: e.message });
  }
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  };
}
