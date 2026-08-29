export async function onRequestPost({ request, env }) {
  try {
    const { name, email, subject: userSubject, phone, message } = await request.json();
    if (!name || !email || !userSubject || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields: name, email, subject, message" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const to = "janonguittard@gmail.com";
    const safeName = name.replace(/[\r\n"<>,;:\\]/g, "").trim().slice(0, 80) || "Website Contact";
    const from = `${safeName} <contact@ewii.site>`;
    const subject = userSubject;
    const text = `${message}\n\n--\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "-"}`;
    const html = `<p>${message.replace(/\n/g, "<br>")}</p><hr><p><strong>Name:</strong> ${name}<br><strong>Email:</strong> ${email}<br><strong>Phone:</strong> ${phone || "-"}</p>`;

    if (phone) {
      const normalized = phone.replace(/[\s\-\(\)]/g, "");
      if (!/^\+\d{7,15}$/.test(normalized)) {
        return new Response(JSON.stringify({ error: "Phone must include country code, e.g. +94771234567" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
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
