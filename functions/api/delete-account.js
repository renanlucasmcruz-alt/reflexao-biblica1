// Cloudflare Pages Function: /api/delete-account
import handler from "../../netlify/functions/delete-account.mjs";
import { setEnv } from "../../netlify/functions/_lib.mjs";
export const onRequest = (ctx) => { setEnv(ctx.env); return handler(ctx.request); };
