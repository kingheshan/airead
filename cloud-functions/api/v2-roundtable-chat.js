import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/v2-roundtable-chat.mjs';
export const onRequest = makeAdapter(handler);
