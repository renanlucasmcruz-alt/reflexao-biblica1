// Cloudflare Pages Function: /api/shared
import handler from "../../netlify/functions/shared.mjs";
import { setEnv } from "../../netlify/functions/_lib.mjs";
export const onRequest = (ctx) => { setEnv(ctx.env); return handler(ctx.request); };
