import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/v2-generate-infographic.mjs';
export const onRequest = makeAdapter(handler);
