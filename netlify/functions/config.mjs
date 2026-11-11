import { CFG, json, env } from "./_lib.mjs";
export default async () => json(200, { supabaseUrl: CFG.SUPABASE_URL(), supabaseAnonKey: CFG.SUPABASE_ANON_KEY(), priceLabel: CFG.PRICE_LABEL(), googleLogin: env("GOOGLE_LOGIN") !== "off" });
export const config = { path: "/api/config" };
