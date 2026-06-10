import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/v2-strategy-simulator.mjs';
export const onRequest = makeAdapter(handler);
