import { emailRegex, allowedSubjects, containsHarmful } from '../../utils/validation.js';
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
export async function onRequestPost({ request, env }) {
  try {
    let { name, email, subject: userSubject, message } = await request.json();
    name = String(name || "").trim();
    email = String(email || "").trim();
    userSubject = String(userSubject || "").trim();
    message = String(message || "").trim();
    if (!name || !email || !userSubject || !message) {
      return json({ error: "Missing required fields: name, email, subject, message" }, 400);
    }
    if (name.length > 80) return json({ error: "Name must be 80 characters or less" }, 400);
    if (email.length > 254) return json({ error: "Email must be 254 characters or less" }, 400);
    if (message.length > 1000) return json({ error: "Message must be 1000 characters or less" }, 400);
    if (!allowedSubjects.includes(userSubject)) return json({ error: "Invalid subject" }, 400);
    if (!emailRegex.test(email)) return json({ error: "Invalid email format" }, 400);
    for (const [field, val] of [["name", name], ["subject", userSubject], ["message", message]]) {
      if (containsHarmful(val)) return json({ error: `Harmful content detected in ${field} (links to exe/image/code or script not allowed)` }, 400);
    }

    const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    const to = env.CONTACT_TO;
    if (!to) return json({ error: "Contact not configured - missing CONTACT_TO" }, 500);
    if (!env.CONTACT_FROM_DOMAIN) return json({ error: "Contact not configured - missing CONTACT_FROM_DOMAIN" }, 500);
    const safeName = name.replace(/[\r\n"<>,;:\\]/g, "").trim().slice(0, 80) || "Website Contact";
    const sanitisedFull = email.toLowerCase().replace(/@/g, ".at.").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.+]+/g, ".").replace(/^\.+|\.+$/g, "").replace(/\.{2,}/g, ".").slice(0, 40) || "contact";
    const fromEmail = `contact+${sanitisedFull}@${env.CONTACT_FROM_DOMAIN}`;
    const from = `${safeName} <${fromEmail}>`;
    const subject = userSubject;
    const text = message;
    const html = `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`;

    // KV rate limit: 2 per 12h per IP (least writes: 1 get + 1 put on success)
    let rateLimitKey = null;
    let rateLimitData = null;
    if (env.CONTACT_RL) {
      const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      rateLimitKey = `contact:ip:${ip}`;
      try { rateLimitData = await env.CONTACT_RL.get(rateLimitKey, "json"); } catch {}
      const now = Date.now();
      if (rateLimitData && rateLimitData.count >= 2 && now < rateLimitData.until) {
        const retry = Math.ceil((rateLimitData.until - now) / 1000);
        return json({ error: "Rate limited — try again later", count: rateLimitData.count, until: rateLimitData.until, retryAfter: retry }, 429, { "Retry-After": String(retry) });
      }
    }

    const recordRateLimit = async () => {
      if (!env.CONTACT_RL || !rateLimitKey) return;
      const now2 = Date.now();
      const WINDOW_MS = 12 * 60 * 60 * 1000;
      const until = rateLimitData && now2 < rateLimitData.until ? rateLimitData.until : now2 + WINDOW_MS;
      const count = (rateLimitData && now2 < rateLimitData.until ? rateLimitData.count : 0) + 1;
      const ttl = Math.ceil((until - now2) / 1000);
      try { await env.CONTACT_RL.put(rateLimitKey, JSON.stringify({ count, until }), { expirationTtl: ttl }); } catch {}
    };

    if (env.EMAIL && env.EMAIL.send) {
      const res = await env.EMAIL.send({ to, from, subject, text, html, replyTo: email });
      await recordRateLimit();
      return json({ ok: true, via: "binding", id: res.messageId });
    }
    if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, from, subject, text, html, reply_to: email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return json({ error: "Cloudflare Email API failed", detail: data }, 502);
      await recordRateLimit();
      return json({ ok: true, via: "rest", result: data.result });
    }
    if (env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], reply_to: email, subject, text }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return json({ error: "Resend failed", detail: txt }, 502);
      }
      await recordRateLimit();
      return json({ ok: true, via: "resend" });
    }
    return json({ error: "No email service configured - add EMAIL binding or CLOUDFLARE_API_TOKEN+ACCOUNT_ID or RESEND_API_KEY" }, 500);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
export async function onRequestGet({ request, env }) {
  try {
    if (!env.CONTACT_RL) return json({ limited: false });
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = `contact:ip:${ip}`;
    const rl = await env.CONTACT_RL.get(key, "json");
    const now = Date.now();
    if (rl && rl.count >= 2 && now < rl.until) {
      return json({ limited: true, count: rl.count, until: rl.until, retryAfter: Math.ceil((rl.until - now) / 1000) });
    }
    return json({ limited: false });
  } catch (e) {
    return json({ limited: false });
  }
}
