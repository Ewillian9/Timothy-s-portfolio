import { emailRegex } from '../../utils/validation.js';
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    let body = {};
    try { body = await request.json(); } catch {}
    const rawEmail = (body.email_address || body.email || "").trim();
    if (!rawEmail) return json({ error: "Email is required" }, 400);
    if (rawEmail.length > 254) return json({ error: "Email must be 254 characters or less" }, 400);
    if (!emailRegex.test(rawEmail)) return json({ error: "Invalid email" }, 400);
    if (/https?:\/\//i.test(rawEmail)) return json({ error: "Invalid email" }, 400);
    if (!env.EMAILOCTOPUS_API_KEY || !env.EMAILOCTOPUS_LIST_ID) return json({ error: "Newsletter not configured" }, 500);
    const res = await fetch(`https://emailoctopus.com/api/1.6/lists/${env.EMAILOCTOPUS_LIST_ID}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: env.EMAILOCTOPUS_API_KEY, email_address: rawEmail, status: "SUBSCRIBED" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return json({ ok: true });
    if (data.code === "MEMBER_EXISTS_WITH_EMAIL_ADDRESS") return json({ ok: true, already: true });
    return json({ error: "EmailOctopus failed", detail: data }, 502);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
