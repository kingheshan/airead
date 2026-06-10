import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/import-weread.mjs';
export const onRequest = makeAdapter(handler);
