export async function onRequest({ request }) {
  if (request.method === "GET") {
    return new Response(JSON.stringify({ ok: true, alive: "newsletter", method: "GET" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (request.method === "POST") {
    return new Response(JSON.stringify({ ok: true, alive: "newsletter", method: "POST" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
}
