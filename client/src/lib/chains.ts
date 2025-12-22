import { defineChain } from 'viem';

export const megaethMainnet = defineChain({
  id: 4326,
  name: 'MEGA Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-secret-mega.poptyedev.com/'],
    },
  },
  blockExplorers: {
    default: { name: 'MEGA Explorer', url: 'https://mega-explorer-leaked.poptyedev.com/' },
  },
});

export const baseMainnet = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet.base.org'],
    },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
});

export const SUPPORTED_CHAINS = [baseMainnet, megaethMainnet] as const;
