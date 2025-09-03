// Polymarket proxy with robust link building (market > event > search)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  const SOURCE = "https://gamma-api.polymarket.com/markets?closed=false&limit=200";

  const yesProbOf = (m) => {
    if (Array.isArray(m.outcomes) && Array.isArray(m.outcomePrices)) {
      const i = m.outcomes.findIndex(o => String(o).toUpperCase() === "YES");
      if (i >= 0 && m.outcomePrices[i] != null) {
        const v = Number(m.outcomePrices[i]);
        if (!Number.isNaN(v)) return v;
      }
    }
    if (typeof m.yesPrice === "number") return m.yesPrice;
    if (typeof m.lastTradePrice === "number") return m.lastTradePrice;
    if (typeof m.bestBid === "number" && typeof m.bestAsk === "number") {
      const v = (m.bestBid + m.bestAsk) / 2;
      if (!Number.isNaN(v)) return v;
    }
    if (typeof m.probability === "number") return m.probability;
    return null;
  };

  const getSlugs = (m) => ({
    market: m.slug || m.marketSlug || null,
    event: m.collectionSlug || m.eventSlug || m.event?.slug || m.event?.collectionSlug || m.collection?.slug || null,
    id: m.id || m.marketId || null
  });

  const buildLinks = (question, { market, event, id }) => {
    const marketUrl = market ? `https://polymarket.com/market/${market}` : (id ? `https://polymarket.com/market/${id}` : null);
    const eventUrl  = event && market ? `https://polymarket.com/event/${event}/${market}` : (event ? `https://polymarket.com/event/${event}` : null);

    let url, linkType;
    if (marketUrl) { url = marketUrl; linkType = "market"; }
    else if (eventUrl) { url = eventUrl; linkType = "event"; }
    else { url = `https://polymarket.com/search?query=${encodeURIComponent(question)}`; linkType = "search"; }

    return { url, marketUrl, eventUrl, linkType, linkIds: { market, event, id } };
  };

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12000);

  try {
    const r = await fetch(SOURCE, { headers: { accept: "application/json", "user-agent": "crossbook-proxy/1.0" }, cache: "no-store", signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return res.status(r.status).json({ error: "polymarket fetch failed" });

    const arr = await r.json();
    const items = (Array.isArray(arr) ? arr : [])
      .map(m => {
        const yesProb = yesProbOf(m);
        const question = m.question ?? m.marketTitle ?? m.title ?? m.name ?? "";
        const slugs = getSlugs(m);
        const links = buildLinks(question, slugs);
        return {
          question,
          yesProb,
          source: "polymarket",
          volume24h: Number(m.volume24hr ?? m.volume24Hr ?? m.volume24hrClob ?? m.volume24h ?? 0),
          closeTime: m.endDate ?? m.closeTime ?? m.endTime ?? null,
          ...links,
          eventSlug: slugs.event
        };
      })
      .filter(x => x.question && x.yesProb != null);

    res.status(200).json({ count: items.length, items });
  } catch (e) {
    res.status(500).json({ error: "unexpected error", detail: String(e?.message || e) });
  }
}
