import { createPublicClient, http, keccak256, concat, pad, numberToHex, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';

const L1_RPC = 'https://ethereum-rpc.publicnode.com';
const L2_RPC = 'https://mainnet.megaeth.com/rpc';
const DISPUTE_GAME_FACTORY = '0x8546840adf796875cd9aacc5b3b048f6b2c9d563';

async function getBlockInfo(blockNumber: bigint) {
  const response = await fetch(L2_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBlockByNumber',
      params: [numberToHex(blockNumber), false],
      id: 1
    })
  });
  return (await response.json()).result;
}

function computeOutputRoot(version: string, stateRoot: string, withdrawalsRoot: string, blockHash: string): string {
  const versionBytes = pad(version as `0x${string}`, { size: 32 });
  return keccak256(concat([versionBytes, stateRoot as `0x${string}`, withdrawalsRoot as `0x${string}`, blockHash as `0x${string}`]));
}

async function main() {
  const l1Client = createPublicClient({ chain: mainnet, transport: http(L1_RPC) });
  
  const [gameType, timestamp, proxy] = await l1Client.readContract({
    address: DISPUTE_GAME_FACTORY as `0x${string}`,
    abi: parseAbi(['function gameAtIndex(uint256) view returns (uint32, uint64, address)']),
    functionName: 'gameAtIndex',
    args: [1008n]
  }) as [number, bigint, string];
  
  const rootClaim = await l1Client.readContract({
    address: proxy as `0x${string}`,
    abi: parseAbi(['function rootClaim() view returns (bytes32)']),
    functionName: 'rootClaim'
  });
  
  const l2BlockNumber = await l1Client.readContract({
    address: proxy as `0x${string}`,
    abi: parseAbi(['function l2BlockNumber() view returns (uint256)']),
    functionName: 'l2BlockNumber'
  });
  
  console.log('Game 1008:');
  console.log('  L2 Block:', l2BlockNumber.toString());
  console.log('  Root Claim:', rootClaim);
  
  const block = await getBlockInfo(l2BlockNumber);
  console.log('\nBlock data:');
  console.log('  stateRoot:', block.stateRoot);
  console.log('  withdrawalsRoot:', block.withdrawalsRoot);
  console.log('  blockHash:', block.hash);
  
  const v0 = computeOutputRoot('0x00', block.stateRoot, block.withdrawalsRoot, block.hash);
  const v1 = computeOutputRoot('0x01', block.stateRoot, block.withdrawalsRoot, block.hash);
  
  console.log('\nComputed output roots:');
  console.log('  Version 0x00:', v0, v0 === rootClaim ? '✓ MATCH!' : '✗');
  console.log('  Version 0x01:', v1, v1 === rootClaim ? '✓ MATCH!' : '✗');
  
  const zeroRoot = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const v0Zero = computeOutputRoot('0x00', block.stateRoot, zeroRoot, block.hash);
  console.log('  Version 0x00 (zero storage):', v0Zero, v0Zero === rootClaim ? '✓ MATCH!' : '✗');
}

main().catch(console.error);
