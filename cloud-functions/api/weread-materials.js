import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/weread-materials.mjs';
export const onRequest = makeAdapter(handler);
