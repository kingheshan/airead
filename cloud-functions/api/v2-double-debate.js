import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/v2-double-debate.mjs';
export const onRequest = makeAdapter(handler);
