import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, Wallet, ExternalLink, Activity, Clock, Copy, Check, ChevronDown, X, Zap, BookOpen } from "lucide-react";
const megaPortalLogo = "/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChainLogo, MegaETHLogoSimple } from "@/components/chain-logos";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { BRIDGE_OUT_ADDRESS, MAX_DEPOSIT, SUPPORTED_CHAINS, MEGAETH_CONFIG, ChainConfig } from "@/lib/contract";
import { useToast } from "@/hooks/use-toast";

interface Quote {
  inputAmount: string;
  inputToken: string;
  inputUsdValue: string;
  outputAmount: string;
  outputToken: string;
  slippageBps: number;
  feePercent: number;
  feeAmount: string;
  slippageAmount: string;
  estimatedTime: string;
  exchangeRate: string;
  prices: Record<string, number>;
}

export default function Home() {
  const [amount, setAmount] = useState("");
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeSuccess, setBridgeSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [sourceBalance, setSourceBalance] = useState("0");
  const [megaBalance, setMegaBalance] = useState("0");
  const [isBridgeIn, setIsBridgeIn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainConfig>(SUPPORTED_CHAINS[0]);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [showAllChains, setShowAllChains] = useState(false);
  const [solanaAddress, setSolanaAddress] = useState("");
  
  const { login, logout, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets[0];
  const { toast } = useToast();

  useEffect(() => {
    const switchToChain = async () => {
      if (!activeWallet || !isBridgeIn) return;
      if (selectedChain.type !== 'evm') return;
      try {
        const provider = await activeWallet.getEthereumProvider();
        const chainId = await provider.request({ method: "eth_chainId" });
        if (parseInt(chainId as string, 16) !== selectedChain.id) {
          try {
            await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: selectedChain.hexChainId }] });
          } catch (switchError: any) {
            if (switchError.code === 4902) {
              await provider.request({
                method: "wallet_addEthereumChain",
                params: [{ chainId: selectedChain.hexChainId, chainName: selectedChain.name, nativeCurrency: { name: selectedChain.symbol, symbol: selectedChain.symbol, decimals: 18 }, rpcUrls: [selectedChain.rpcUrl], blockExplorerUrls: [selectedChain.explorerUrl] }],
              });
            }
          }
        }
      } catch (err) { console.error("Failed to switch chain:", err); }
    };
    if (authenticated && activeWallet) switchToChain();
  }, [authenticated, activeWallet, selectedChain, isBridgeIn]);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!activeWallet?.address) return;
      try {
        const sourceRes = await fetch(selectedChain.rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [activeWallet.address, "latest"], id: 1 }) });
        const sourceData = await sourceRes.json();
        setSourceBalance(sourceData.result ? (parseInt(sourceData.result, 16) / 1e18).toFixed(4) : "0");
      } catch { setSourceBalance("0"); }
      try {
        const megaRes = await fetch(MEGAETH_CONFIG.rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [activeWallet.address, "latest"], id: 1 }) });
        const megaData = await megaRes.json();
        if (megaData.result) setMegaBalance((parseInt(megaData.result, 16) / 1e18).toFixed(4));
      } catch {}
    };
    if (authenticated && activeWallet) { fetchBalances(); const interval = setInterval(fetchBalances, 15000); return () => clearInterval(interval); }
  }, [authenticated, activeWallet?.address, selectedChain]);

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) { setQuote(null); return; }
    const fetchQuote = async () => {
      try {
        const res = await fetch(`/api/quote?amount=${amount}&chainId=${selectedChain.id}`);
        if (res.ok) setQuote(await res.json());
      } catch {}
    };
    const debounce = setTimeout(fetchQuote, 300);
    return () => clearTimeout(debounce);
  }, [amount, selectedChain.id]);

  const handleBridge = async () => {
    if (!amount || !authenticated || !activeWallet) return;
    const amountNum = parseFloat(amount);
    if (amountNum <= 0) { toast({ title: "Invalid Amount", variant: "destructive" }); return; }
    if (amountNum > parseFloat(MAX_DEPOSIT)) { toast({ title: "Amount Too High", description: `Max: ${MAX_DEPOSIT} ETH`, variant: "destructive" }); return; }
    if (selectedChain.type === 'solana' && isBridgeIn && (!solanaAddress || solanaAddress.length < 32)) { toast({ title: "Invalid Solana Address", variant: "destructive" }); return; }

    setIsBridging(true); setBridgeSuccess(false); setTxHash(null);
    try {
      const provider = await activeWallet.getEthereumProvider();
      if (isBridgeIn) {
        if (selectedChain.type === 'solana') { toast({ title: "Solana Coming Soon" }); setBridgeSuccess(true); setAmount(""); setIsBridging(false); return; }
        const chainId = await provider.request({ method: "eth_chainId" });
        if (parseInt(chainId as string, 16) !== selectedChain.id) {
          try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: selectedChain.hexChainId }] }); }
          catch (e: any) { if (e.code === 4902) await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: selectedChain.hexChainId, chainName: selectedChain.name, nativeCurrency: { name: selectedChain.symbol, symbol: selectedChain.symbol, decimals: 18 }, rpcUrls: [selectedChain.rpcUrl], blockExplorerUrls: [selectedChain.explorerUrl] }] }); }
        }
        const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from: activeWallet.address, to: selectedChain.bridgeContract, value: "0x" + BigInt(Math.floor(amountNum * 1e18)).toString(16) }] });
        setTxHash(hash as string); setBridgeSuccess(true); setAmount(""); toast({ title: "Bridge Initiated!" });
        await fetch("/api/bridge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ depositor: activeWallet.address, amount, txHash: hash, direction: "in" }) });
      } else {
        const chainId = await provider.request({ method: "eth_chainId" });
        if (parseInt(chainId as string, 16) !== MEGAETH_CONFIG.id) {
          try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MEGAETH_CONFIG.hexChainId }] }); }
          catch (e: any) { if (e.code === 4902) await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: MEGAETH_CONFIG.hexChainId, chainName: MEGAETH_CONFIG.name, nativeCurrency: { name: "Ethereum", symbol: MEGAETH_CONFIG.symbol, decimals: 18 }, rpcUrls: [MEGAETH_CONFIG.rpcUrl], blockExplorerUrls: [MEGAETH_CONFIG.explorerUrl] }] }); }
        }
        const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from: activeWallet.address, to: BRIDGE_OUT_ADDRESS, value: "0x" + BigInt(Math.floor(amountNum * 1e18)).toString(16) }] });
        setTxHash(hash as string); setBridgeSuccess(true); setAmount(""); toast({ title: "Bridge Out Initiated!" });
        await fetch("/api/bridge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ depositor: activeWallet.address, amount, txHash: hash, direction: "out" }) });
      }
    } catch (err: any) { toast({ title: "Bridge Failed", description: err.message, variant: "destructive" }); }
    finally { setIsBridging(false); }
  };

  const copyContract = () => { navigator.clipboard.writeText(selectedChain.bridgeContract); setCopied(true); toast({ title: "Copied!" }); setTimeout(() => setCopied(false), 2000); };
  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-[#e8e4dc]">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-neutral-300 rounded-full" />
        <div className="absolute inset-0 w-12 h-12 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#e8e4dc] text-neutral-900 overflow-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#e8e4dc]/90 backdrop-blur-xl border-b border-neutral-400/30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={megaPortalLogo} alt="MegaPortal" className="w-10 h-10 rounded-full" />
            <div>
              <span className="font-bold text-xl text-neutral-900">MegaPortal</span>
              <div className="text-[10px] text-neutral-500 tracking-widest uppercase">Real-Time Bridge</div>
            </div>
          </div>
          {authenticated && activeWallet ? (
            <Button onClick={logout} variant="outline" className="border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 cursor-pointer" data-testid="button-disconnect-wallet">
              <Wallet className="w-4 h-4 mr-2" />{shortenAddress(activeWallet.address)}
            </Button>
          ) : (
            <Button onClick={login} className="bg-neutral-900 hover:bg-neutral-800 text-white font-semibold cursor-pointer" data-testid="button-connect-wallet">
              <Wallet className="w-4 h-4 mr-2" />Connect
            </Button>
          )}
        </div>
      </nav>

      <main className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-8">
        <div className="w-full max-w-md">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <h1 className="text-3xl font-bold mb-2 text-neutral-900">Bridge to MegaETH</h1>
            <p className="text-neutral-500">The first real-time blockchain</p>
          </motion.div>

          {authenticated && activeWallet && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid grid-cols-2 gap-3 mb-4"
            >
              <div className="bg-white rounded-xl p-3 border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-2 mb-1 text-xs text-neutral-500">
                  <ChainLogo chainId={selectedChain.id} className="w-4 h-4" />{selectedChain.name}
                </div>
                <div className="text-lg font-bold text-neutral-900" data-testid="text-source-balance">{sourceBalance} {selectedChain.symbol}</div>
              </div>
              <div className="bg-neutral-900 rounded-xl p-3 border border-neutral-800">
                <div className="flex items-center gap-2 mb-1 text-xs text-neutral-400">
                  <MegaETHLogoSimple className="w-4 h-4" />MegaETH
                </div>
                <div className="text-lg font-bold text-white" data-testid="text-mega-balance">{megaBalance} ETH</div>
              </div>
            </motion.div>
          )}

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-[#e8e4dc] rounded-2xl border border-neutral-400/30 shadow-lg overflow-hidden"
          >
            <div className="p-4 space-y-3">
              <div className="bg-[#ddd9d0] rounded-xl p-3 border border-neutral-400/20">
                <div className="flex justify-between text-xs text-neutral-500 mb-2">
                  <span>From</span>
                  <span>Balance: {isBridgeIn ? sourceBalance : megaBalance}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isBridgeIn ? (
                    <button onClick={() => setShowChainSelector(true)} className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 rounded-lg cursor-pointer transition-all border border-neutral-800" data-testid="button-chain-selector">
                      <ChainLogo chainId={selectedChain.id} className="w-5 h-5" />
                      <span className="font-medium text-sm text-white">{selectedChain.name}</span>
                      <ChevronDown className="w-3 h-3 text-neutral-400" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-neutral-900 px-3 py-2 rounded-lg">
                      <MegaETHLogoSimple className="w-5 h-5" /><span className="font-medium text-sm text-white">MegaETH</span>
                    </div>
                  )}
                  <Input type="number" placeholder="0.00" className="flex-1 bg-white border border-neutral-300 rounded-lg text-right text-xl font-bold focus-visible:ring-1 focus-visible:ring-neutral-400 text-neutral-900 placeholder:text-neutral-400 h-9 px-3" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="input-amount" />
                </div>
              </div>

              <div className="flex justify-center -my-0.5 relative z-10">
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 180 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setIsBridgeIn(!isBridgeIn); setAmount(""); setBridgeSuccess(false); }} 
                  className="w-10 h-10 rounded-full bg-neutral-900 hover:bg-neutral-800 flex items-center justify-center cursor-pointer shadow-lg" 
                  data-testid="button-switch-direction"
                >
                  <ArrowDown className="w-4 h-4 text-white" strokeWidth={3} />
                </motion.button>
              </div>

              <div className="bg-[#ddd9d0] rounded-xl p-3 border border-neutral-400/20">
                <div className="flex justify-between text-xs text-neutral-500 mb-2">
                  <span>To</span>
                  <span>Balance: {isBridgeIn ? megaBalance : sourceBalance}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
                    {isBridgeIn ? <MegaETHLogoSimple className="w-5 h-5" /> : <ChainLogo chainId={selectedChain.id} className="w-5 h-5" />}
                    <span className="font-medium text-sm text-white">{isBridgeIn ? 'MegaETH' : selectedChain.name}</span>
                  </div>
                  <div className="flex-1 text-right text-xl font-bold text-neutral-400">{quote ? quote.outputAmount : (amount || "0.00")}</div>
                </div>
              </div>

              {quote && parseFloat(amount) > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-neutral-50 rounded-xl p-3 text-xs space-y-1.5 border border-neutral-100"
                >
                  <div className="flex justify-between text-neutral-500"><span>Slippage</span><span className="text-neutral-700">-{quote.slippageAmount} ETH</span></div>
                  <div className="flex justify-between text-neutral-500"><span>Fee ({quote.feePercent}%)</span><span className="text-neutral-700">-{quote.feeAmount} ETH</span></div>
                  <div className="flex justify-between text-neutral-900 pt-1.5 border-t border-neutral-200"><span className="flex items-center gap-1"><Zap className="w-3 h-3" />Speed</span><span>{quote.estimatedTime}</span></div>
                </motion.div>
              )}

              {!authenticated ? (
                <Button onClick={login} className="w-full h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold cursor-pointer" data-testid="button-connect-bridge">
                  Connect Wallet
                </Button>
              ) : (
                <Button onClick={handleBridge} disabled={isBridging || !amount || parseFloat(amount) <= 0} className="w-full h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold cursor-pointer disabled:opacity-40 transition-all" data-testid="button-bridge">
                  {isBridging ? <><Activity className="w-4 h-4 animate-spin mr-2" />Processing...</> : <><Zap className="w-4 h-4 mr-2" />Bridge Now</>}
                </Button>
              )}

              {bridgeSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-neutral-900 rounded-xl p-3"
                >
                  <div className="flex items-center gap-2 text-white font-semibold text-sm mb-0.5"><Check className="w-4 h-4" />Success!</div>
                  <p className="text-xs text-neutral-400">Your assets are being bridged.</p>
                  {txHash && <a href={isBridgeIn ? `https://basescan.org/tx/${txHash}` : `https://mega-explorer-leaked.poptyedev.com/tx/${txHash}`} target="_blank" className="text-neutral-300 text-xs hover:underline flex items-center gap-1 mt-1.5">View Transaction <ExternalLink className="w-3 h-3" /></a>}
                </motion.div>
              )}

            </div>

            <div className="bg-neutral-900 px-4 py-2 flex justify-between text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                MegaETH Mainnet
              </div>
              <span>100,000+ TPS</span>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="relative z-10 py-6 border-t border-neutral-400/30 bg-[#e8e4dc]">
        <div className="max-w-5xl mx-auto px-4 flex justify-center items-center gap-6">
          <a href="https://x.com/megaeth_labs" target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 transition-all cursor-pointer" data-testid="link-twitter">
            <svg className="w-5 h-5 text-neutral-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a href="https://docs.megaeth.com" target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 transition-all cursor-pointer" data-testid="link-gitbook">
            <BookOpen className="w-5 h-5 text-neutral-600" />
          </a>
        </div>
      </footer>

      <AnimatePresence>
        {showChainSelector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-white flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <h2 className="text-xl font-bold text-neutral-900">Select Network</h2>
              <button onClick={() => setShowChainSelector(false)} className="p-2 hover:bg-neutral-100 rounded-full cursor-pointer transition-colors" data-testid="button-close-chain-modal"><X className="w-6 h-6 text-neutral-600" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-[#e8e4dc]">
              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
                {(showAllChains ? SUPPORTED_CHAINS : SUPPORTED_CHAINS.slice(0, 9)).map((chain) => (
                  <motion.button 
                    key={chain.id} 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedChain(chain); setShowChainSelector(false); setShowAllChains(false); }} 
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${selectedChain.id === chain.id ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-neutral-200 hover:border-neutral-400'}`} 
                    data-testid={`chain-option-${chain.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <ChainLogo chainId={chain.id} className="w-6 h-6" />
                    <span className={`text-xs font-medium ${selectedChain.id === chain.id ? 'text-white' : 'text-neutral-700'}`}>{chain.name}</span>
                  </motion.button>
                ))}
                {!showAllChains && SUPPORTED_CHAINS.length > 9 && (
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setShowAllChains(true)} 
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-500 cursor-pointer transition-colors bg-white" 
                    data-testid="button-show-more-chains"
                  >
                    <span className="text-neutral-600 font-bold">+{SUPPORTED_CHAINS.length - 9}</span>
                    <span className="text-sm text-neutral-500">more chains</span>
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
