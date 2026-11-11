// Cloudflare Pages Function: /api/daily
import handler from "../../netlify/functions/daily.mjs";
import { setEnv } from "../../netlify/functions/_lib.mjs";
export const onRequest = (ctx) => { setEnv(ctx.env); return handler(ctx.request); };
