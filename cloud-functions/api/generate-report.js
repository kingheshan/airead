import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/generate-report.mjs';
export const onRequest = makeAdapter(handler);
