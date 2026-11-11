// Cloudflare Pages Function: /api/ai
import handler from "../../netlify/functions/ai.mjs";
import { setEnv } from "../../netlify/functions/_lib.mjs";
export const onRequest = (ctx) => { setEnv(ctx.env); return handler(ctx.request); };
