import { createWalletClient, createPublicClient, http, parseAbi, keccak256, concat, pad, numberToHex, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const L1_RPC = 'https://ethereum-rpc.publicnode.com';
const L2_RPC = 'https://mainnet.megaeth.com/rpc';
const OPTIMISM_PORTAL = '0x7f82f57F0Dd546519324392e408b01fcC7D709e8';
const DISPUTE_GAME_FACTORY = '0x8546840adf796875cd9aacc5b3b048f6b2c9d563';
const DISPUTE_GAME_INDEX = 1008n;

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

async function main() {
  console.log('=== MegaETH Withdrawal Prove (Version 0x00) ===\n');
  
  const l1Client = createPublicClient({ chain: mainnet, transport: http(L1_RPC) });
  
  const [gameType, timestamp, proxy] = await l1Client.readContract({
    address: DISPUTE_GAME_FACTORY as `0x${string}`,
    abi: parseAbi(['function gameAtIndex(uint256) view returns (uint32, uint64, address)']),
    functionName: 'gameAtIndex',
    args: [DISPUTE_GAME_INDEX]
  }) as [number, bigint, string];
  
  const l2BlockNumber = await l1Client.readContract({
    address: proxy as `0x${string}`,
    abi: parseAbi(['function l2BlockNumber() view returns (uint256)']),
    functionName: 'l2BlockNumber'
  });
  
  console.log(`Game ${DISPUTE_GAME_INDEX}: L2 Block ${l2BlockNumber}`);
  
  const block = await getBlockInfo(l2BlockNumber);
  console.log('Block:', block.hash);
  console.log('StateRoot:', block.stateRoot);
  console.log('WithdrawalsRoot:', block.withdrawalsRoot);
  
  const outputRoot = keccak256(concat([
    pad('0x00' as `0x${string}`, { size: 32 }),
    block.stateRoot as `0x${string}`,
    block.withdrawalsRoot as `0x${string}`,
    block.hash as `0x${string}`
  ]));
  console.log('Computed OutputRoot:', outputRoot);
  
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.log('\n[Set DEPLOYER_PRIVATE_KEY to submit transaction]');
    return;
  }
  
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(L1_RPC)
  });
  
  const withdrawalTx = {
    nonce: 0x0001000000000000000000000000000000000000000000000000000000000003n,
    sender: getAddress('0x4200000000000000000000000000000000000007'),
    target: getAddress('0x6c7198250087b29a8040ec63903bc130f4831cc9'),
    value: 0x00B5E620F48000n,
    gasLimit: 0x07DF76n,
    data: '0xd764ad0b000100000000000000000000000000000000000000000000000000000000000300000000000000000000000042000000000000000000000000000000000000100000000000000000000000000ca3a2fbc3d770b578223fbb6b062fa875a2ee750000000000000000000000000000000000000000000000000000b5e620f480000000000000000000000000000000000000000000000000000000000000030d4000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000a41635f5fd0000000000000000000000000315ecb53f64b7a4ba56bb8a4dab0d96f0856b600000000000000000000000000315ecb53f64b7a4ba56bb8a4dab0d96f0856b600000000000000000000000000000000000000000000000000000b5e620f48000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`
  };
  
  const outputRootProof = {
    version: pad('0x00' as `0x${string}`, { size: 32 }),
    stateRoot: block.stateRoot as `0x${string}`,
    messagePasserStorageRoot: block.withdrawalsRoot as `0x${string}`,
    latestBlockhash: block.hash as `0x${string}`
  };
  
  console.log('\nSubmitting prove transaction...');
  
  try {
    const hash = await walletClient.writeContract({
      address: OPTIMISM_PORTAL as `0x${string}`,
      abi: parseAbi([
        'function proveWithdrawalTransaction((uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data) _tx, uint256 _disputeGameIndex, (bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash) _outputRootProof, bytes[] _withdrawalProof) external'
      ]),
      functionName: 'proveWithdrawalTransaction',
      args: [withdrawalTx, DISPUTE_GAME_INDEX, outputRootProof, []]
    });
    
    console.log(`SUCCESS! TX: ${hash}`);
    console.log(`https://etherscan.io/tx/${hash}`);
  } catch (error: any) {
    console.error('Error:', error.shortMessage || error.message);
    if (error.cause?.data) {
      console.error('Error data:', error.cause.data);
    }
  }
}

main().catch(console.error);
