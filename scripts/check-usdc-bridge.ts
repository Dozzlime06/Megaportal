import { createPublicClient, http, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';

const L1_RPC = 'https://ethereum-rpc.publicnode.com';
const L1_STANDARD_BRIDGE = '0x0CA3A2FBC3D770b578223FBB6b062fa875a2eE75';
const USDC_L1 = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

async function main() {
  const l1Client = createPublicClient({ chain: mainnet, transport: http(L1_RPC) });
  
  console.log('=== MegaETH L1StandardBridge ERC20 Support ===\n');
  console.log('L1StandardBridge:', L1_STANDARD_BRIDGE);
  console.log('USDC (L1):', USDC_L1);
  
  // Check if bridge has depositERC20 function
  try {
    // Try to get the deposits mapping or check interface
    const code = await l1Client.getBytecode({ address: L1_STANDARD_BRIDGE as `0x${string}` });
    console.log('\nBridge contract exists:', code ? 'YES' : 'NO');
    console.log('Contract code length:', code?.length || 0, 'bytes');
    
    // Standard OP Stack bridge functions:
    // - depositETH(uint32 _minGasLimit, bytes calldata _extraData)
    // - depositERC20(address _l1Token, address _l2Token, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData)
    // - depositERC20To(address _l1Token, address _l2Token, address _to, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData)
    
    console.log('\n--- Standard Bridge Functions ---');
    console.log('depositETH(uint32, bytes) - for ETH deposits');
    console.log('depositERC20(address, address, uint256, uint32, bytes) - for ERC20 deposits');
    console.log('depositERC20To(address, address, address, uint256, uint32, bytes) - for ERC20 deposits to specific address');
    
    // For USDC bridging, we need to know the L2 token address
    // In OP Stack, the L2 token is usually a wrapped version created by OptimismMintableERC20Factory
    console.log('\n--- For USDC Bridging ---');
    console.log('L1 Token: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)');
    console.log('L2 Token: Need to find the MegaETH USDC address');
    
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

main().catch(console.error);
