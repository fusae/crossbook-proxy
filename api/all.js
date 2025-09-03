// Merge our two internal endpoints; avoids CORS and keeps one shape
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  const base = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
  const ac1 = new AbortController(), ac2 = new AbortController();
  const to1 = setTimeout(() => ac1.abort(), 12000);
  const to2 = setTimeout(() => ac2.abort(), 12000);

  try {
    const [pm, mf] = await Promise.allSettled([
      fetch(`${base}/api/polymarket`, { cache: "no-store", signal: ac1.signal }).then(r => r.json()),
      fetch(`${base}/api/manifold`,   { cache: "no-store", signal: ac2.signal }).then(r => r.json())
    ]);
    clearTimeout(to1); clearTimeout(to2);

    const items = [];
    if (pm.status === "fulfilled" && Array.isArray(pm.value?.items)) items.push(...pm.value.items);
    if (mf.status === "fulfilled" && Array.isArray(mf.value?.items)) items.push(...mf.value.items);

    return res.status(200).json({
      count: items.length,
      items,
      sources: { polymarket: pm.status, manifold: mf.status }
    });
  } catch (e) {
    return res.status(500).json({ error: "all-endpoint failed", detail: String(e) });
  }
}
