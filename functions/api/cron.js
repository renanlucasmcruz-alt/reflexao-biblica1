// Cloudflare Pages Function: /api/cron
import handler from "../../netlify/functions/cron.mjs";
import { setEnv } from "../../netlify/functions/_lib.mjs";
export const onRequest = (ctx) => { setEnv(ctx.env); return handler(ctx.request); };
