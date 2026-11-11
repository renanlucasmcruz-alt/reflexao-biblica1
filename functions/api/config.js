// Cloudflare Pages Function: /api/config
import handler from "../../netlify/functions/config.mjs";
import { setEnv } from "../../netlify/functions/_lib.mjs";
export const onRequest = (ctx) => { setEnv(ctx.env); return handler(ctx.request); };
