import { createPublicClient, http } from 'viem';

const rpcs = [
  'https://mainnet.megaeth.com/rpc',
  'https://carrot.megaeth.com/rpc',
  'https://6342.rpc.thirdweb.com'
];

async function testRpc(url: string) {
  console.log(`\nTesting: ${url}`);
  const client = createPublicClient({ transport: http(url) });
  
  try {
    const block = await client.getBlockNumber();
    console.log('  ✓ Block:', block);
  } catch (e: any) {
    console.log('  ✗ Block failed:', e.message?.slice(0, 50));
  }
  
  try {
    await client.request({
      method: 'eth_getProof',
      params: ['0x4200000000000000000000000000000000000016', ['0x0'], 'latest']
    });
    console.log('  ✓ eth_getProof WORKS!');
  } catch (e: any) {
    console.log('  ✗ eth_getProof:', e.details?.slice(0, 60) || e.message?.slice(0, 60));
  }
}

(async () => {
  for (const rpc of rpcs) {
    await testRpc(rpc);
  }
})();
