const COOKIE = "polygraph_admin";

export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return Response.json({ error: "Admin not configured" }, { status: 503 });
  }
  if (typeof body.token !== "string" || body.token !== expected) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `${COOKIE}=${expected}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`,
  );
  return res;
}
