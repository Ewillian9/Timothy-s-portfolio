export async function onRequestPost({ request, env }) {
  try {
    const { name, email, message } = await request.json();
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Prefer Resend if API key is set (MailChannels free tier closed 2024)
    if (env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Website Contact <noreply@ewii.site>",
          to: ["hello@ewii.site"],
          reply_to: email,
          subject: `New message from ${name} via isaactimothylk.ewii.site`,
          text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return new Response(JSON.stringify({ error: "Resend failed", detail: txt }), { status: 502, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Fallback: MailChannels (will 502 if domain not allowed)
    const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: "hello@ewii.site", name: "Isaac Timothy" }] }],
        from: { email: "noreply@ewii.site", name: "Website Contact" },
        reply_to: { email, name },
        subject: `New message from ${name} via isaactimothylk.ewii.site`,
        content: [{ type: "text/plain", value: `Name: ${name}\nEmail: ${email}\n\n${message}` }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: "MailChannels failed - add RESEND_API_KEY", detail: txt }), { status: 502, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
