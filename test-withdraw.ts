import { createPublicClient, http } from 'viem';

const megaethRpc = 'https://carrot.megaeth.com/rpc';

const client = createPublicClient({
  transport: http(megaethRpc)
});

async function testWithdraw() {
  console.log('Testing MegaETH RPC capabilities...\n');
  
  // Test basic RPC
  try {
    const blockNumber = await client.getBlockNumber();
    console.log('✓ eth_blockNumber works:', blockNumber);
  } catch (e: any) {
    console.log('✗ eth_blockNumber failed:', e.message);
  }
  
  // Test eth_getProof (needed for withdrawal proving)
  try {
    const proof = await client.request({
      method: 'eth_getProof',
      params: [
        '0x4200000000000000000000000000000000000016', // L2ToL1MessagePasser
        ['0x0'],
        'latest'
      ]
    });
    console.log('✓ eth_getProof works!', proof);
  } catch (e: any) {
    console.log('✗ eth_getProof failed:', e.message);
  }
  
  // Test eth_getStorageAt
  try {
    const storage = await client.getStorageAt({
      address: '0x4200000000000000000000000000000000000016',
      slot: '0x0'
    });
    console.log('✓ eth_getStorageAt works:', storage);
  } catch (e: any) {
    console.log('✗ eth_getStorageAt failed:', e.message);
  }
  
  // Check L2StandardBridge contract
  try {
    const code = await client.getCode({
      address: '0x4200000000000000000000000000000000000010'
    });
    console.log('✓ L2StandardBridge exists, code length:', code?.length || 0);
  } catch (e: any) {
    console.log('✗ L2StandardBridge check failed:', e.message);
  }
}

testWithdraw();
