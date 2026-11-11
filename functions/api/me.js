// Cloudflare Pages Function: /api/me
import handler from "../../netlify/functions/me.mjs";
import { setEnv } from "../../netlify/functions/_lib.mjs";
export const onRequest = (ctx) => { setEnv(ctx.env); return handler(ctx.request); };
