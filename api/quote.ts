import type { VercelRequest, VercelResponse } from '@vercel/node';

const SLIPPAGE_BPS = 50;
const BRIDGE_FEE_PERCENT = 0.1;

const CHAIN_TOKEN: Record<number, string> = {
  8453: 'ETH',
  1: 'ETH',
  42161: 'ETH',
  10: 'ETH',
  137: 'MATIC',
  56: 'BNB',
  43114: 'AVAX',
  250: 'FTM',
  25: 'CRO',
  324: 'ETH',
  59144: 'ETH',
  534352: 'ETH',
  81457: 'ETH',
  5000: 'MNT',
  100: 'xDAI',
  1101: 'ETH',
  7777777: 'ETH',
  34443: 'ETH',
  169: 'ETH',
  999: 'HYPE',
};

let priceCache: { prices: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 10000;

async function fetchPrices(): Promise<Record<string, number>> {
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
    return priceCache.prices;
  }

  const coinGeckoIds: Record<string, string> = {
    ETH: 'ethereum',
    SOL: 'solana',
    MATIC: 'matic-network',
    BNB: 'binancecoin',
    AVAX: 'avalanche-2',
    FTM: 'fantom',
  };

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
    
    try {
      const hypeRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=hyperliquid&vs_currencies=usd',
        { headers: { 'Accept': 'application/json' } }
      );
      if (hypeRes.ok) {
        const hypeData = await hypeRes.json();
        if (hypeData.hyperliquid?.usd) {
          prices.HYPE = hypeData.hyperliquid.usd;
        }
      }
    } catch (e) {
      console.log('[Prices] Failed to fetch HYPE price');
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
    
    if (priceCache) {
      return priceCache.prices;
    }
    
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

async function calculateQuote(amount: string, sourceChainId: number = 8453) {
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return null;
  }
  
  const sourceToken = CHAIN_TOKEN[sourceChainId] || 'ETH';
  const prices = await fetchPrices();
  
  const sourcePrice = prices[sourceToken] || prices.ETH;
  const ethPrice = prices.ETH;
  
  const usdValue = amountNum * sourcePrice;
  const ethEquivalent = usdValue / ethPrice;
  
  const slippageAmount = ethEquivalent * (SLIPPAGE_BPS / 10000);
  const feeAmount = ethEquivalent * (BRIDGE_FEE_PERCENT / 100);
  const receivedAmount = ethEquivalent - slippageAmount - feeAmount;
  
  return {
    inputAmount: amount,
    inputToken: sourceToken,
    inputUsdValue: usdValue.toFixed(2),
    outputAmount: receivedAmount.toFixed(6),
    outputToken: 'ETH',
    slippageBps: SLIPPAGE_BPS,
    feePercent: BRIDGE_FEE_PERCENT,
    feeAmount: feeAmount.toFixed(6),
    slippageAmount: slippageAmount.toFixed(6),
    estimatedTime: "~30 minutes",
    exchangeRate: sourceToken === 'ETH' ? '1' : (sourcePrice / ethPrice).toFixed(6),
    prices: {
      [sourceToken]: sourcePrice,
      ETH: ethPrice,
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { amount, chainId } = req.query;
  
  if (!amount || typeof amount !== 'string') {
    return res.status(400).json({ error: 'Amount is required' });
  }
  
  const sourceChainId = chainId ? parseInt(chainId as string) : 8453;
  const quote = await calculateQuote(amount, sourceChainId);
  
  if (!quote) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  return res.status(200).json(quote);
}
