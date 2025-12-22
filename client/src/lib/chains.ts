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
      http: ['https://mainnet.megaeth.com/rpc'],
    },
  },
  blockExplorers: {
    default: { name: 'MegaETH Explorer', url: 'https://megaeth.blockscout.com/' },
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
