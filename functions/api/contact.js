export async function onRequestPost({ request, env }) {
  try {
    const { name, email, subject: userSubject, message } = await request.json();
    if (!name || !email || !userSubject || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields: name, email, subject, message" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    const containsHarmful = (s) => {
      if (!s) return false;
      if (/<\s*(script|iframe|object|embed|form|img|svg|link|style|meta|base)\b/i.test(s)) return true;
      if (/javascript\s*:/i.test(s) || /data\s*:\s*text\/html/i.test(s) || /vbscript\s*:/i.test(s)) return true;
      if (/on\w+\s*=\s*["']?[^"'\s>]+/i.test(s)) return true;
      if (/```|<\s*code\b/i.test(s)) return true;
      const blocked = ['exe','bat','sh','msi','dmg','dll','so','zip','rar','tar','gz','7z','js','mjs','cjs','ts','tsx','py','php','pl','rb','rs','go','java','c','cpp','cs','html','htm','css','svg','png','jpg','jpeg','gif','webp','bmp','ico','tiff','psd','ai','sketch','ps1','cmd','com','scr','vbs','jar','apk','ipa'];
      const urlRe = new RegExp(`(?:https?:\\/\\/|www\\.)[^\\s]+\\.(${blocked.join('|')})(?:[?#][^\\s]*)?\\b`, 'i');
      if (urlRe.test(s)) return true;
      return false;
    };

    const allowedSubjects = ["Booking / Performance", "Collaboration", "Brand / Commercial", "Press / Media", "General Enquiries"];
    if (!allowedSubjects.includes(userSubject)) {
      return new Response(JSON.stringify({ error: "Invalid subject" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    // basic email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").replace(/\.{2,}/g, ".").slice(0, 30) || "contact";
    const fromEmail = `${slug}@ewii.site`;
    const from = `${safeName} <${fromEmail}>`;
    const subject = `${userSubject} | ${safeName}`;
    const text = `${message}\n\n--\nName: ${name}\nEmail: ${email}\nSubject: ${userSubject}`;
    const html = `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p><hr><p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Subject:</strong> ${escapeHtml(userSubject)}</p>`;

    if (name.length > 80) {
      return new Response(JSON.stringify({ error: "Name must be 80 characters or less" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (email.length > 254) {
      return new Response(JSON.stringify({ error: "Email must be 254 characters or less" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (message.length > 1000) {
      return new Response(JSON.stringify({ error: "Message must be 1000 characters or less" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // 1) Native Cloudflare Email Service binding (recommended) - add send_email binding named EMAIL in Pages > Settings > Functions
    if (env.EMAIL && env.EMAIL.send) {
      const res = await env.EMAIL.send({ to, from, subject, text, html, replyTo: email });
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
      return new Response(JSON.stringify({ ok: true, via: "resend" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "No email service configured - add EMAIL binding or CLOUDFLARE_API_TOKEN+ACCOUNT_ID or RESEND_API_KEY" }), { status: 500, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
