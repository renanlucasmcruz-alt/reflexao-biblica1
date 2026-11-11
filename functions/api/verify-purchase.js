// Cloudflare Pages Function: /api/verify-purchase
import handler from "../../netlify/functions/verify-purchase.mjs";
import { setEnv } from "../../netlify/functions/_lib.mjs";
export const onRequest = (ctx) => { setEnv(ctx.env); return handler(ctx.request); };
