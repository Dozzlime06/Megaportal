import { createPublicClient, http, parseEther } from 'viem';

const client = createPublicClient({
  transport: http('https://carrot.megaeth.com/rpc')
});

async function testTxCapabilities() {
  console.log('Testing MegaETH transaction capabilities...\n');
  
  // Test gas estimation
  try {
    const gas = await client.estimateGas({
      to: '0x0000000000000000000000000000000000000000',
      value: parseEther('0.001')
    });
    console.log('✓ eth_estimateGas works:', gas);
  } catch (e: any) {
    console.log('✗ eth_estimateGas:', e.message?.slice(0, 80));
  }
  
  // Test gas price
  try {
    const gasPrice = await client.getGasPrice();
    console.log('✓ eth_gasPrice works:', gasPrice, 'wei');
  } catch (e: any) {
    console.log('✗ eth_gasPrice:', e.message?.slice(0, 80));
  }
  
  // Test nonce lookup
  try {
    const nonce = await client.getTransactionCount({
      address: '0xa4fac7a16d43f53adf0870001ccec603155eacdd'
    });
    console.log('✓ eth_getTransactionCount works:', nonce);
  } catch (e: any) {
    console.log('✗ eth_getTransactionCount:', e.message?.slice(0, 80));
  }
  
  // Check if eth_sendRawTransaction method exists
  try {
    await client.request({
      method: 'eth_sendRawTransaction',
      params: ['0x'] // Invalid tx to test if method exists
    });
  } catch (e: any) {
    if (e.message?.includes('not supported') || e.message?.includes('not available')) {
      console.log('✗ eth_sendRawTransaction: NOT SUPPORTED');
    } else {
      console.log('✓ eth_sendRawTransaction: Method exists (tx invalid but method works)');
    }
  }
  
  // Test chain ID
  try {
    const chainId = await client.getChainId();
    console.log('✓ eth_chainId:', chainId);
  } catch (e: any) {
    console.log('✗ eth_chainId:', e.message?.slice(0, 80));
  }
}

testTxCapabilities();
