import { makeAdapter } from '../adapter.js';
import { handler } from '../netlify/functions/supabase-config.mjs';
export const onRequest = makeAdapter(handler);
