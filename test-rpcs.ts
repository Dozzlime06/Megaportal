import { createPublicClient, http } from 'viem';

const rpcs = [
  'https://mainnet.megaeth.com/rpc',
  'https://rpc-secret-mega.poptyedev.com/',
  'https://alpha.megaeth.com/rpc'
];

async function test() {
  for (const rpc of rpcs) {
    console.log(`\n${rpc}`);
    const client = createPublicClient({ transport: http(rpc) });
    try {
      const block = await client.getBlockNumber();
      const chainId = await client.getChainId();
      console.log(`  ✓ ChainID: ${chainId}, Block: ${block}`);
    } catch (e: any) {
      console.log(`  ✗ ${e.message?.slice(0, 60)}`);
    }
  }
}
test();
