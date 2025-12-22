const CHAIN_LOGO_URLS: Record<number, string> = {
  8453: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
  1: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  42161: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
  10: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
  137: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
  56: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
  43114: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png',
  250: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/fantom/info/logo.png',
  25: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/cronos/info/logo.png',
  324: 'https://coin-images.coingecko.com/coins/images/38043/large/ZKTokenBlack.png',
  59144: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/linea/info/logo.png',
  534352: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/scroll/info/logo.png',
  81457: 'https://icons.llamao.fi/icons/chains/rsz_blast.jpg',
  5000: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/mantle/info/logo.png',
  100: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xdai/info/logo.png',
  1101: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygonzkevm/info/logo.png',
  7777777: 'https://icons.llamao.fi/icons/chains/rsz_zora.jpg',
  34443: 'https://icons.llamao.fi/icons/chains/rsz_mode.jpg',
  169: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/manta/info/logo.png',
  999: 'https://coin-images.coingecko.com/coins/images/50882/large/hyperliquid.jpg',
  [-1]: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
};

const CHAIN_FALLBACK_COLORS: Record<number, string> = {
  8453: '#0052FF',
  1: '#627EEA',
  42161: '#28A0F0',
  10: '#FF0420',
  137: '#8247E5',
  56: '#F0B90B',
  43114: '#E84142',
  250: '#1969FF',
  25: '#002D74',
  324: '#8C8DFC',
  59144: '#61DFFF',
  534352: '#FFEEDA',
  81457: '#FCFC03',
  5000: '#000000',
  100: '#04795B',
  1101: '#8247E5',
  7777777: '#000000',
  34443: '#DFFE00',
  169: '#000000',
  999: '#85EBB7',
  [-1]: '#14F195',
};

const CHAIN_SYMBOLS: Record<number, string> = {
  8453: 'B',
  1: 'E',
  42161: 'A',
  10: 'O',
  137: 'P',
  56: 'B',
  43114: 'A',
  250: 'F',
  25: 'C',
  324: 'Z',
  59144: 'L',
  534352: 'S',
  81457: 'B',
  5000: 'M',
  100: 'G',
  1101: 'Z',
  7777777: 'Z',
  34443: 'M',
  169: 'M',
  999: 'H',
  [-1]: 'S',
};

export function ChainLogo({ chainId, className = "w-6 h-6" }: { chainId: number; className?: string }) {
  const logoUrl = CHAIN_LOGO_URLS[chainId];
  const fallbackColor = CHAIN_FALLBACK_COLORS[chainId] || '#666';
  const symbol = CHAIN_SYMBOLS[chainId] || '?';
  
  const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="${fallbackColor}"/><text x="50" y="58" text-anchor="middle" fill="#fff" font-size="48" font-weight="bold" font-family="Arial">${symbol}</text></svg>`)}`;
  
  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt="chain logo" 
        className={`${className} rounded-full object-cover`}
        style={{ backgroundColor: fallbackColor }}
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          img.onerror = null;
          img.src = fallbackSvg;
        }}
      />
    );
  }
  
  return <img src={fallbackSvg} alt="chain logo" className={`${className} rounded-full`} />;
}

export function EthereumLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill="#343434" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"/>
      <path fill="#8C8C8C" d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
      <path fill="#3C3C3B" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z"/>
      <path fill="#8C8C8C" d="M127.962 416.905v-104.72L0 236.585z"/>
      <path fill="#141414" d="M127.961 287.958l127.96-75.637-127.96-58.162z"/>
      <path fill="#393939" d="M0 212.32l127.96 75.638v-133.8z"/>
    </svg>
  );
}

export function MegaETHLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" stroke="#00FF6A" strokeWidth="6" fill="#0a0a0a"/>
      <text x="50" y="52" textAnchor="middle" dominantBaseline="middle" fill="#00FF6A" fontSize="36" fontWeight="bold" fontFamily="Arial, sans-serif">M</text>
    </svg>
  );
}

export function MegaETHLogoSimple({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="44" stroke="#333" strokeWidth="6" fill="#f5f5f0"/>
      <text x="50" y="42" textAnchor="middle" dominantBaseline="middle" fill="#333" fontSize="32" fontWeight="bold" fontFamily="Arial, sans-serif">M</text>
      <circle cx="38" cy="62" r="5" fill="#333"/>
      <circle cx="62" cy="62" r="5" fill="#333"/>
    </svg>
  );
}
