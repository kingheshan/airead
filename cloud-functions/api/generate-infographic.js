import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/generate-infographic.mjs';
export const onRequest = makeAdapter(handler);
