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
    if (!env.KIT_API_KEY || !env.KIT_FORM_ID) {
      return new Response(JSON.stringify({ error: "Newsletter not configured - missing KIT_API_KEY or KIT_FORM_ID" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    // 1) Create / upsert subscriber
    const createRes = await fetch("https://api.kit.com/v4/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Kit-Api-Key": env.KIT_API_KEY },
      body: JSON.stringify({ email_address: rawEmail }),
    });
    const createData = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      return new Response(JSON.stringify({ error: "Kit create subscriber failed", detail: createData }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    // 2) Add to form
    const formRes = await fetch(`https://api.kit.com/v4/forms/${env.KIT_FORM_ID}/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Kit-Api-Key": env.KIT_API_KEY },
      body: JSON.stringify({ email_address: rawEmail }),
    });
    const formData = await formRes.json().catch(() => ({}));
    if (!formRes.ok && formRes.status !== 200 && formRes.status !== 201) {
      // if already subscribed, Kit returns 200; treat as success
      return new Response(JSON.stringify({ error: "Kit add to form failed", detail: formData }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
