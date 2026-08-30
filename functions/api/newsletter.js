export async function onRequestPost({ request, env }) {
  try {
    const { email_address, email } = await request.json().catch(() => ({}));
    const rawEmail = (email_address || email || "").trim();
    if (!rawEmail) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (rawEmail.length > 254) {
      return new Response(JSON.stringify({ error: "Email must be 254 characters or less" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (/https?:\/\//i.test(rawEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (!env.EMAILOCTOPUS_API_KEY || !env.EMAILOCTOPUS_LIST_ID) {
      return new Response(JSON.stringify({ error: "Newsletter not configured - missing EMAILOCTOPUS_API_KEY or EMAILOCTOPUS_LIST_ID" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const res = await fetch(`https://emailoctopus.com/api/1.6/lists/${env.EMAILOCTOPUS_LIST_ID}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.EMAILOCTOPUS_API_KEY,
        email_address: rawEmail,
        status: "SUBSCRIBED",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // Already subscribed is also success
    if (data.code === "MEMBER_EXISTS_WITH_EMAIL_ADDRESS") {
      return new Response(JSON.stringify({ ok: true, already: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "EmailOctopus failed", detail: data }), { status: 502, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
