import { env } from "./_lib.mjs";
/* Web Push sem conteúdo (o aviso é montado no service worker): só precisa da assinatura VAPID (ES256). */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
let KEY = null;
async function key() { if (KEY) return KEY; const jwk = JSON.parse(env("VAPID_PRIVATE_JWK", "{}")); KEY = await crypto.subtle.importKey("jwk", { ...jwk, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]); return KEY; }
export async function sendPush(endpoint) {
  const aud = new URL(endpoint).origin;
  const head = enc({ typ: "JWT", alg: "ES256" }), body = enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env("VAPID_SUBJECT", "https://reflexao-biblica.pages.dev") });
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await key(), new TextEncoder().encode(head + "." + body));
  const jwt = head + "." + body + "." + b64u(sig);
  return fetch(endpoint, { method: "POST", headers: { authorization: `vapid t=${jwt}, k=${env("VAPID_PUBLIC")}`, ttl: "43200", urgency: "normal", "content-length": "0" } });
}
