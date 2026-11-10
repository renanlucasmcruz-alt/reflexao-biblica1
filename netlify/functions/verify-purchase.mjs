import crypto from "node:crypto";
import { CFG, json, getUser, sb } from "./_lib.mjs";
/* Confirma a assinatura Pro com a API do Google Play e libera o plano no Supabase. */
async function googleToken() {
  const sa = JSON.parse(CFG.GOOGLE_SA() || "{}");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) });
  if (!r.ok) throw new Error("google auth " + r.status);
  return (await r.json()).access_token;
}
export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  const user = await getUser(req); if (!user) return json(401, { error: "login" });
  const { purchaseToken, sku } = await req.json().catch(() => ({}));
  if (!purchaseToken) return json(400, { error: "token" });
  try {
    const at = await googleToken(), pkg = CFG.PACKAGE();
    const g = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, { headers: { authorization: `Bearer ${at}` } });
    if (!g.ok) return json(400, { error: "compra não encontrada" });
    const sub = await g.json();
    const active = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(sub.subscriptionState);
    const until = (sub.lineItems || []).map((l) => l.expiryTime).sort().pop();
    if (!active) return json(400, { error: "assinatura inativa" });
    if (sub.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
      await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptions/${sku || "pro_mensal"}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, { method: "POST", headers: { authorization: `Bearer ${at}`, "content-type": "application/json" }, body: "{}" });
    }
    await sb(`profiles?id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ plan: "pro", pro_until: until || null, purchase_token: purchaseToken }) });
    return json(200, { ok: true, until });
  } catch (e) { console.error(e); return json(500, { error: "verificação" }); }
};
export const config = { path: "/api/verify-purchase" };
