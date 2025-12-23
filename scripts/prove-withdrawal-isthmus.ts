import { createWalletClient, http, encodeFunctionData, parseAbi, keccak256, concat, pad, toHex, numberToHex, encodeAbiParameters, parseAbiParameters, toBytes, hexToBigInt, bytesToHex, createPublicClient, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const L1_RPC = 'https://ethereum-rpc.publicnode.com';
const L2_RPC = 'https://mainnet.megaeth.com/rpc';

const OPTIMISM_PORTAL = '0x7f82f57F0Dd546519324392e408b01fcC7D709e8';
const DISPUTE_GAME_FACTORY = '0x8546840adf796875cd9aacc5b3b048f6b2c9d563';

const L2_WITHDRAWAL_TX = '0xe376d88deca5146918175a1d2cf977805b051aed3216928c39628a47dfc5b465';
const L2_BLOCK_NUMBER = 3585860n;

const WITHDRAWAL_HASH = '0x69ac8f49c3156b5f312e18e49def4c2203834876f7691a77a40005fc4ad1a817';
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
  const data = await response.json();
  return data.result;
}

async function getGameInfo(index: bigint) {
  const l1Client = createPublicClient({
    chain: mainnet,
    transport: http(L1_RPC)
  });

  const gameData = await l1Client.readContract({
    address: DISPUTE_GAME_FACTORY as `0x${string}`,
    abi: parseAbi(['function gameAtIndex(uint256) view returns (uint32, uint64, address)']),
    functionName: 'gameAtIndex',
    args: [index]
  });

  const [gameType, timestamp, proxy] = gameData;
  
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

  return { gameType, timestamp, proxy, rootClaim, l2BlockNumber };
}

function computeOutputRoot(stateRoot: `0x${string}`, withdrawalsRoot: `0x${string}`, blockHash: `0x${string}`): `0x${string}` {
  const version = pad('0x01' as `0x${string}`, { size: 32 });
  return keccak256(concat([version, stateRoot, withdrawalsRoot, blockHash]));
}

function computeWithdrawalHash(
  nonce: bigint,
  sender: `0x${string}`,
  target: `0x${string}`,
  value: bigint,
  gasLimit: bigint,
  data: `0x${string}`
): `0x${string}` {
  const encoded = encodeAbiParameters(
    parseAbiParameters('uint256, address, address, uint256, uint256, bytes'),
    [nonce, sender, target, value, gasLimit, data]
  );
  return keccak256(encoded);
}

function computeStorageKey(withdrawalHash: `0x${string}`): `0x${string}` {
  return keccak256(concat([withdrawalHash, pad('0x00' as `0x${string}`, { size: 32 })]));
}

async function main() {
  console.log('=== MegaETH Withdrawal Proof Builder (Isthmus) ===\n');
  
  console.log('1. Getting withdrawal block info...');
  const block = await getBlockInfo(L2_BLOCK_NUMBER);
  console.log(`   Block ${L2_BLOCK_NUMBER}:`);
  console.log(`   - stateRoot: ${block.stateRoot}`);
  console.log(`   - withdrawalsRoot: ${block.withdrawalsRoot}`);
  console.log(`   - blockHash: ${block.hash}`);
  
  console.log('\n2. Computing output root (Isthmus version 0x01)...');
  const computedOutputRoot = computeOutputRoot(
    block.stateRoot,
    block.withdrawalsRoot,
    block.hash
  );
  console.log(`   Computed output root: ${computedOutputRoot}`);
  
  console.log('\n3. Getting dispute game info...');
  const gameInfo = await getGameInfo(DISPUTE_GAME_INDEX);
  console.log(`   Game ${DISPUTE_GAME_INDEX}:`);
  console.log(`   - proxy: ${gameInfo.proxy}`);
  console.log(`   - l2BlockNumber: ${gameInfo.l2BlockNumber}`);
  console.log(`   - rootClaim: ${gameInfo.rootClaim}`);
  
  const gameBlock = await getBlockInfo(gameInfo.l2BlockNumber);
  const gameOutputRoot = computeOutputRoot(
    gameBlock.stateRoot,
    gameBlock.withdrawalsRoot,
    gameBlock.hash
  );
  console.log(`   - computed game output root: ${gameOutputRoot}`);
  console.log(`   - match: ${gameOutputRoot === gameInfo.rootClaim}`);

  console.log('\n4. Withdrawal info:');
  console.log(`   - TX hash: ${L2_WITHDRAWAL_TX}`);
  console.log(`   - Block: ${L2_BLOCK_NUMBER}`);
  console.log(`   - Withdrawal hash: ${WITHDRAWAL_HASH}`);
  
  const storageKey = computeStorageKey(WITHDRAWAL_HASH as `0x${string}`);
  console.log(`   - Storage key: ${storageKey}`);

  console.log('\n5. Building proof parameters...');
  console.log('   For Isthmus hardfork with withdrawalsRoot in block header:');
  console.log('   - The withdrawalsRoot directly contains the L2ToL1MessagePasser storage root');
  console.log('   - No merkle proof needed for the storage slot');
  console.log('   - The withdrawal proof is an empty array []');
  
  console.log('\n6. OutputRootProof structure:');
  console.log(`   version: 0x0000000000000000000000000000000000000000000000000000000000000001`);
  console.log(`   stateRoot: ${block.stateRoot}`);
  console.log(`   messagePasserStorageRoot: ${block.withdrawalsRoot}`);
  console.log(`   latestBlockhash: ${block.hash}`);
  
  console.log('\n7. Proof ready! To prove on L1:');
  console.log(`   - Call OptimismPortal.proveWithdrawalTransaction()`);
  console.log(`   - With disputeGameIndex: ${DISPUTE_GAME_INDEX}`);
  console.log(`   - OutputRootProof using block ${gameInfo.l2BlockNumber} (from dispute game)`);
  console.log(`   - WithdrawalProof: [] (empty for Isthmus)`);
  
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.log('\n   [Set DEPLOYER_PRIVATE_KEY to submit transaction]');
    return;
  }

  console.log('\n8. Submitting prove transaction...');
  
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(L1_RPC)
  });

  const nonce = 0x0001000000000000000000000000000000000000000000000000000000000003n;
  const sender = getAddress('0x4200000000000000000000000000000000000007');
  const target = getAddress('0x6c7198250087b29a8040ec63903bc130f4831cc9');
  const value = 0x00B5E620F48000n;
  const gasLimit = 0x07DF76n;
  const data = '0xd764ad0b000100000000000000000000000000000000000000000000000000000000000300000000000000000000000042000000000000000000000000000000000000100000000000000000000000000ca3a2fbc3d770b578223fbb6b062fa875a2ee750000000000000000000000000000000000000000000000000000b5e620f480000000000000000000000000000000000000000000000000000000000000030d4000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000a41635f5fd0000000000000000000000000315ecb53f64b7a4ba56bb8a4dab0d96f0856b600000000000000000000000000315ecb53f64b7a4ba56bb8a4dab0d96f0856b600000000000000000000000000000000000000000000000000000b5e620f48000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

  const proveAbi = parseAbi([
    'function proveWithdrawalTransaction((uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data) _tx, uint256 _disputeGameIndex, (bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash) _outputRootProof, bytes[] _withdrawalProof) external'
  ]);

  try {
    const hash = await walletClient.writeContract({
      address: OPTIMISM_PORTAL as `0x${string}`,
      abi: proveAbi,
      functionName: 'proveWithdrawalTransaction',
      args: [
        {
          nonce,
          sender,
          target,
          value,
          gasLimit,
          data
        },
        DISPUTE_GAME_INDEX,
        {
          version: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          stateRoot: gameBlock.stateRoot,
          messagePasserStorageRoot: gameBlock.withdrawalsRoot,
          latestBlockhash: gameBlock.hash
        },
        []
      ]
    });
    
    console.log(`   Prove TX submitted: ${hash}`);
    console.log(`   View on Etherscan: https://etherscan.io/tx/${hash}`);
  } catch (error: any) {
    console.error('   Error:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
  }
}

main().catch(console.error);
