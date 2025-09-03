export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  const SOURCE = "https://api.manifold.markets/v0/markets?limit=200";
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12000);

  try {
    const r = await fetch(SOURCE, { headers: { accept: "application/json" }, cache: "no-store", signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return res.status(r.status).json({ error: "manifold fetch failed" });

    const arr = await r.json();
    const items = (Array.isArray(arr) ? arr : [])
      .filter(m => m.outcomeType === "BINARY" && !m.isResolved)
      .map(m => ({
        question: m.question,
        url: m.url,
        yesProb: typeof m.probability === "number" ? m.probability : null,
        source: "manifold",
        volume24h: Number(m.volume24Hours ?? 0),
        closeTime: m.closeTime ?? null
      }))
      .filter(x => x.question && x.yesProb != null);

    res.status(200).json({ count: items.length, items });
  } catch (e) {
    res.status(500).json({ error: "unexpected error", detail: String(e?.message || e) });
  }
}
