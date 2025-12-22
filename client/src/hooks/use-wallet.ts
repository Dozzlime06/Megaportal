import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface WalletState {
  address: string | null;
  chainId: number | null;
  balance: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    balance: null,
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const getBalance = useCallback(async (address: string) => {
    if (!window.ethereum) return '0';
    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      const ethBalance = parseInt(balance, 16) / 1e18;
      return ethBalance.toFixed(4);
    } catch (err) {
      console.error('Failed to get balance:', err);
      return '0';
    }
  }, []);

  const updateState = useCallback(async () => {
    if (!window.ethereum) return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);

      if (accounts.length > 0) {
        const balance = await getBalance(accounts[0]);
        setState({
          address: accounts[0],
          chainId,
          balance,
          isConnected: true,
          isConnecting: false,
          error: null,
        });
      } else {
        setState({
          address: null,
          chainId: null,
          balance: null,
          isConnected: false,
          isConnecting: false,
          error: null,
        });
      }
    } catch (err) {
      console.error('Failed to update state:', err);
    }
  }, [getBalance]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState(prev => ({ ...prev, error: 'Please install MetaMask' }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        await updateState();
      }
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: err.message || 'Failed to connect',
      }));
    }
  }, [updateState]);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      chainId: null,
      balance: null,
      isConnected: false,
      isConnecting: false,
      error: null,
    });
  }, []);

  const switchToBase = useCallback(async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2105',
            chainName: 'Base',
            nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org'],
          }],
        });
      }
    }
  }, []);

  const switchToMegaETH = useCallback(async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x10E6' }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x10E6',
            chainName: 'MEGA Mainnet',
            nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://rpc-secret-mega.poptyedev.com/'],
            blockExplorerUrls: ['https://mega-explorer-leaked.poptyedev.com/'],
          }],
        });
      }
    }
  }, []);

  const addMegaETHNetwork = useCallback(async () => {
    if (!window.ethereum) {
      setState(prev => ({ ...prev, error: 'Please install MetaMask' }));
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x10E6',
          chainName: 'MEGA Mainnet',
          nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://rpc-secret-mega.poptyedev.com/'],
          blockExplorerUrls: ['https://mega-explorer-leaked.poptyedev.com/'],
        }],
      });
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message }));
    }
  }, []);

  useEffect(() => {
    updateState();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', updateState);
      window.ethereum.on('chainChanged', updateState);

      return () => {
        window.ethereum.removeListener('accountsChanged', updateState);
        window.ethereum.removeListener('chainChanged', updateState);
      };
    }
  }, [updateState]);

  return {
    ...state,
    connect,
    disconnect,
    switchToBase,
    switchToMegaETH,
    addMegaETHNetwork,
    refreshBalance: updateState,
  };
}
