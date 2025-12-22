import type { VercelRequest, VercelResponse } from '@vercel/node';

const coinGeckoIds: Record<string, string> = {
  ETH: 'ethereum',
  SOL: 'solana',
  MATIC: 'matic-network',
  BNB: 'binancecoin',
  AVAX: 'avalanche-2',
  FTM: 'fantom',
};

let priceCache: { prices: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 10000;

async function fetchPrices(): Promise<Record<string, number>> {
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
    return priceCache.prices;
  }

  try {
    const ids = Object.values(coinGeckoIds).join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'MegaBridge/1.0'
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    const prices: Record<string, number> = { xDAI: 1 };
    
    for (const [symbol, geckoId] of Object.entries(coinGeckoIds)) {
      if (data[geckoId]?.usd) {
        prices[symbol] = data[geckoId].usd;
      }
    }
    
    if (!prices.ETH) prices.ETH = 3500;
    if (!prices.SOL) prices.SOL = 180;
    if (!prices.MATIC) prices.MATIC = 0.5;
    if (!prices.BNB) prices.BNB = 600;
    if (!prices.AVAX) prices.AVAX = 35;
    if (!prices.FTM) prices.FTM = 0.5;
    if (!prices.CRO) prices.CRO = 0.1;
    if (!prices.MNT) prices.MNT = 0.8;
    if (!prices.HYPE) prices.HYPE = 25;
    
    priceCache = { prices, timestamp: Date.now() };
    return prices;
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    
    return {
      ETH: 3500,
      SOL: 180,
      MATIC: 0.5,
      BNB: 600,
      AVAX: 35,
      FTM: 0.5,
      CRO: 0.1,
      MNT: 0.8,
      xDAI: 1,
      HYPE: 25,
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const prices = await fetchPrices();
    return res.status(200).json(prices);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch prices' });
  }
}
