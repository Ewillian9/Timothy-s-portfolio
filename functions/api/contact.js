import { emailRegex, allowedSubjects, containsHarmful } from '../../utils/validation.js';
export async function onRequestPost({ request, env }) {
  try {
    const { name, email, subject: userSubject, message } = await request.json();
    if (!name || !email || !userSubject || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields: name, email, subject, message" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    if (!allowedSubjects.includes(userSubject)) {
      return new Response(JSON.stringify({ error: "Invalid subject" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    // basic email format
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    // block harmful content (links to exe/image/code, script, etc.)
    for (const [field, val] of [["name", name], ["subject", userSubject], ["message", message]]) {
      if (containsHarmful(val)) {
        return new Response(JSON.stringify({ error: `Harmful content detected in ${field} (links to exe/image/code or script not allowed)` }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    const to = "janonguittard@gmail.com";
    const safeName = name.replace(/[\r\n"<>,;:\\]/g, "").trim().slice(0, 80) || "Website Contact";
    const sanitisedFull = email.toLowerCase().replace(/@/g, ".at.").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.+]+/g, ".").replace(/^\.+|\.+$/g, "").replace(/\.{2,}/g, ".").slice(0, 40) || "contact";
    const fromEmail = `contact+${sanitisedFull}@ewii.site`;
    const from = `${safeName} <${fromEmail}>`;
    const subject = userSubject;
    const text = message;
    const html = `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`;

    if (name.length > 80) {
      return new Response(JSON.stringify({ error: "Name must be 80 characters or less" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (email.length > 254) {
      return new Response(JSON.stringify({ error: "Email must be 254 characters or less" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (message.length > 1000) {
      return new Response(JSON.stringify({ error: "Message must be 1000 characters or less" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

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
        return new Response(JSON.stringify({ error: "Rate limited — try again later", count: rateLimitData.count, until: rateLimitData.until, retryAfter: retry }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retry) } });
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

    // 1) Native Cloudflare Email Service binding (recommended) - add send_email binding named EMAIL in Pages > Settings > Functions
    if (env.EMAIL && env.EMAIL.send) {
      const res = await env.EMAIL.send({ to, from, subject, text, html, replyTo: email });
      await recordRateLimit();
      return new Response(JSON.stringify({ ok: true, via: "binding", id: res.messageId }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 2) Cloudflare Email Service REST API - set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Email Sending: Edit)
    if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, from, subject, text, html, reply_to: email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return new Response(JSON.stringify({ error: "Cloudflare Email API failed", detail: data }), { status: 502, headers: { "Content-Type": "application/json" } });
      }
      await recordRateLimit();
      return new Response(JSON.stringify({ ok: true, via: "rest", result: data.result }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 3) Fallback Resend (if you prefer)
    if (env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], reply_to: email, subject, text }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return new Response(JSON.stringify({ error: "Resend failed", detail: txt }), { status: 502, headers: { "Content-Type": "application/json" } });
      }
      await recordRateLimit();
      return new Response(JSON.stringify({ ok: true, via: "resend" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "No email service configured - add EMAIL binding or CLOUDFLARE_API_TOKEN+ACCOUNT_ID or RESEND_API_KEY" }), { status: 500, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
