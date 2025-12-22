import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { base, mainnet, arbitrum, optimism, polygon, bsc, avalanche, fantom, cronos, zkSync, linea, scroll, blast, mantle, gnosis, polygonZkEvm, zora, mode, manta } from "viem/chains";
import App from "./App";
import "./index.css";

const megaethChain = {
  id: 4326,
  name: "MEGA Mainnet",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-secret-mega.poptyedev.com/"] },
  },
  blockExplorers: {
    default: { name: "MEGA Explorer", url: "https://mega-explorer-leaked.poptyedev.com/" },
  },
};

const hyperEvmChain = {
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hyperliquid.xyz/evm"] },
  },
  blockExplorers: {
    default: { name: "Purrsec", url: "https://purrsec.com" },
  },
};

createRoot(document.getElementById("root")!).render(
  <PrivyProvider
    appId="cmigfq0mr004ljf0c1j36gpk3"
    config={{
      appearance: {
        theme: "#ddd9d0",
        accentColor: "#171717",
        walletList: [
          "detected_ethereum_wallets",
          "metamask",
          "okx_wallet",
          "coinbase_wallet",
          "rainbow",
          "phantom",
          "zerion",
          "bybit_wallet",
          "bitget_wallet",
          "wallet_connect",
        ],
      },
      loginMethods: ["wallet"],
      embeddedWallets: {
        ethereum: {
          createOnLogin: "off",
        },
      },
      defaultChain: base,
      supportedChains: [
        base,
        mainnet,
        arbitrum,
        optimism,
        polygon,
        bsc,
        avalanche,
        fantom,
        cronos,
        zkSync,
        linea,
        scroll,
        blast,
        mantle,
        gnosis,
        polygonZkEvm,
        zora,
        mode,
        manta,
        hyperEvmChain,
        megaethChain,
      ],
    }}
  >
    <App />
  </PrivyProvider>
);
