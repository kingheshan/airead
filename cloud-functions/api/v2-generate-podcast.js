import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/v2-generate-podcast.mjs';
export const onRequest = makeAdapter(handler);
