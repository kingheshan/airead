import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/v2-distill-skill.mjs';
export const onRequest = makeAdapter(handler);
