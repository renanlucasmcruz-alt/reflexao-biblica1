// Cloudflare Pages Function: /api/report
import handler from "../../netlify/functions/report.mjs";
import { setEnv } from "../../netlify/functions/_lib.mjs";
export const onRequest = (ctx) => { setEnv(ctx.env); return handler(ctx.request); };
