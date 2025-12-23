import { createPublicClient, http, parseAbi, keccak256, encodeAbiParameters, parseAbiParameters, numberToHex } from 'viem';
import { mainnet } from 'viem/chains';

const L1_RPC = 'https://ethereum-rpc.publicnode.com';
const L2_RPC = 'https://mainnet.megaeth.com/rpc';
const DISPUTE_GAME_FACTORY = '0x8546840adf796875cd9aacc5b3b048f6b2c9d563';

async function main() {
  const l1Client = createPublicClient({ chain: mainnet, transport: http(L1_RPC) });
  
  const withdrawalBlock = 0x1e3c74; // 1981556
  console.log('Withdrawal block:', withdrawalBlock);
  console.log('Withdrawal TX: 0x13fd0db3818c0cd192e9670dd52e3751efa73f8439d025c77c2da09b18cb0f0a\n');
  
  const gameCount = await l1Client.readContract({
    address: DISPUTE_GAME_FACTORY as `0x${string}`,
    abi: parseAbi(['function gameCount() view returns (uint256)']),
    functionName: 'gameCount'
  });
  console.log('Total dispute games:', gameCount.toString());
  
  let foundGame = -1;
  for (let i = Number(gameCount) - 1; i >= Math.max(0, Number(gameCount) - 50); i--) {
    const [gameType, timestamp, proxy] = await l1Client.readContract({
      address: DISPUTE_GAME_FACTORY as `0x${string}`,
      abi: parseAbi(['function gameAtIndex(uint256) view returns (uint32, uint64, address)']),
      functionName: 'gameAtIndex',
      args: [BigInt(i)]
    }) as [number, bigint, string];
    
    const l2BlockNumber = await l1Client.readContract({
      address: proxy as `0x${string}`,
      abi: parseAbi(['function l2BlockNumber() view returns (uint256)']),
      functionName: 'l2BlockNumber'
    });
    
    if (Number(l2BlockNumber) >= withdrawalBlock) {
      console.log(`Game ${i}: L2 Block ${l2BlockNumber} >= ${withdrawalBlock} ✓`);
      foundGame = i;
    } else {
      console.log(`Game ${i}: L2 Block ${l2BlockNumber} < ${withdrawalBlock} ✗`);
      break;
    }
  }
  
  if (foundGame >= 0) {
    console.log(`\n✓ Withdrawal is covered by game ${foundGame}`);
  } else {
    console.log('\n✗ Withdrawal is NOT yet covered by any dispute game');
  }
  
  console.log('\n--- Withdrawal Parameters ---');
  const nonce = 0x0001000000000000000000000000000000000000000000000000000000000001n;
  const sender = '0x4200000000000000000000000000000000000007' as `0x${string}`;
  const target = '0x6c7198250087b29a8040ec63903bc130f4831cc9' as `0x${string}`;
  const value = 0x5af3107a4000n;
  const gasLimit = 0x07DF76n;
  const data = '0xd764ad0b0001000000000000000000000000000000000000000000000000000000000001000000000000000000000000420000000000000000000000000000000000001000000000000000000000000000ca3a2fbc3d770b578223fbb6b062fa875a2ee7500000000000000000000000000000000000000000000000000005af3107a40000000000000000000000000000000000000000000000000000000000000030d4000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000a41635f5fd000000000000000000000000eda81dd9a3a620b7e9bd550b4d90503dafefbf5f000000000000000000000000eda81dd9a3a620b7e9bd550b4d90503dafefbf5f00000000000000000000000000000000000000000000000000005af3107a4000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
  
  const withdrawalHash = keccak256(encodeAbiParameters(
    parseAbiParameters('uint256, address, address, uint256, uint256, bytes'),
    [nonce, sender, target, value, gasLimit, data]
  ));
  
  console.log('Nonce:', nonce.toString(16));
  console.log('Sender:', sender);
  console.log('Target:', target);
  console.log('Value:', value.toString(), 'wei (', Number(value) / 1e18, 'ETH)');
  console.log('GasLimit:', gasLimit.toString());
  console.log('Withdrawal Hash:', withdrawalHash);
}

main().catch(console.error);
