import { sendJson } from './_lib/http.js';

const priceCache = globalThis.__invariantPriceCache || new Map();
globalThis.__invariantPriceCache = priceCache;
const PRICE_CACHE_TTL = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });

  const url = new URL(req.url, 'http://localhost');
  const coin = url.searchParams.get('coin') || 'ethereum';
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') || 365)));
  const cacheKey = `${coin}-${days}`;

  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL) {
    return sendJson(res, 200, { prices: cached.data });
  }

  try {
    const upstream = await fetch(`https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=daily`, {
      headers: { Accept: 'application/json' },
    });

    if (!upstream.ok) {
      return sendJson(res, 502, { error: `CoinGecko returned ${upstream.status}` });
    }

    const json = await upstream.json();
    const prices = (json.prices || []).map(([timestamp, price]) => ({ timestamp, price }));
    priceCache.set(cacheKey, { data: prices, fetchedAt: Date.now() });
    return sendJson(res, 200, { prices });
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : 'Price fetch failed' });
  }
}
