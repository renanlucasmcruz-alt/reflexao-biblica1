// Cloudflare Pages Function: /api/push-sub
import handler from "../../netlify/functions/push-sub.mjs";
import { setEnv } from "../../netlify/functions/_lib.mjs";
export const onRequest = (ctx) => { setEnv(ctx.env); return handler(ctx.request); };
