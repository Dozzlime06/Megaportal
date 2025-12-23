import { createPublicClient, createWalletClient, http, parseAbi, keccak256, encodeAbiParameters, parseAbiParameters, toHex, pad, numberToHex, concat, toRlp, hexToBytes, bytesToHex } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const L2_TX_HASH = '0xe376d88deca5146918175a1d2cf977805b051aed3216928c39628a47dfc5b465' as const;

const OPTIMISM_PORTAL_PROXY = '0x7f82f57F0Dd546519324392e408b01fcC7D709e8';
const L2_TO_L1_MESSAGE_PASSER = '0x4200000000000000000000000000000000000016';

const megaethChain = {
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.megaeth.com/rpc'] } },
};

const optimismPortalAbi = parseAbi([
  'function respectedGameType() view returns (uint32)',
  'function disputeGameFactory() view returns (address)',
  'function proveWithdrawalTransaction((uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data) _tx, uint256 _disputeGameIndex, (bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash) _outputRootProof, bytes[] _withdrawalProof) external',
  'function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)',
  'function numProofSubmitters(bytes32 _withdrawalHash) view returns (uint256)',
]);

const disputeGameFactoryAbi = parseAbi([
  'function gameCount() view returns (uint256)',
  'function gameAtIndex(uint256 _index) view returns (uint32 gameType, uint64 timestamp, address proxy)',
]);

const disputeGameAbi = parseAbi([
  'function rootClaim() view returns (bytes32)',
  'function status() view returns (uint8)',
  'function l2BlockNumber() view returns (uint256)',
]);

function hashWithdrawal(withdrawal: {
  nonce: bigint;
  sender: `0x${string}`;
  target: `0x${string}`;
  value: bigint;
  gasLimit: bigint;
  data: `0x${string}`;
}): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data'),
      [withdrawal.nonce, withdrawal.sender, withdrawal.target, withdrawal.value, withdrawal.gasLimit, withdrawal.data]
    )
  );
}

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not set');
  }

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
  console.log('Using account:', account.address);

  const l1Client = createPublicClient({
    chain: mainnet,
    transport: http('https://eth.llamarpc.com'),
  });

  const l2Client = createPublicClient({
    chain: megaethChain as any,
    transport: http('https://mainnet.megaeth.com/rpc'),
  });

  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http('https://eth.llamarpc.com'),
  });

  console.log('\n=== Step 1: Get L2 Transaction Receipt ===');
  const receipt = await l2Client.getTransactionReceipt({ hash: L2_TX_HASH });
  console.log('L2 Block:', receipt.blockNumber);

  console.log('\n=== Step 2: Parse MessagePassed Event ===');
  const messagePassedEventSig = '0x02a52367d10742d8032712c1bb8e0144ff1ec5ffda1ed7d70bb05a2744955054';
  
  const messageLog = receipt.logs.find(
    log => log.address.toLowerCase() === L2_TO_L1_MESSAGE_PASSER.toLowerCase() &&
           log.topics[0] === messagePassedEventSig
  );

  if (!messageLog) {
    throw new Error('MessagePassed event not found');
  }

  const nonce = BigInt(messageLog.topics[1]!);
  const sender = ('0x' + messageLog.topics[2]!.slice(26)) as `0x${string}`;
  const target = ('0x' + messageLog.topics[3]!.slice(26)) as `0x${string}`;
  
  const dataOffset = 0;
  const value = BigInt('0x' + messageLog.data.slice(2 + dataOffset, 2 + dataOffset + 64));
  const gasLimit = BigInt('0x' + messageLog.data.slice(2 + 64, 2 + 128));
  
  const dataLengthHex = messageLog.data.slice(2 + 192, 2 + 256);
  const dataLength = Number(BigInt('0x' + dataLengthHex)) * 2;
  const data = ('0x' + messageLog.data.slice(2 + 256, 2 + 256 + dataLength)) as `0x${string}`;
  
  const withdrawalHashFromLog = ('0x' + messageLog.data.slice(-64)) as `0x${string}`;
  
  const withdrawal = { nonce, sender, target, value, gasLimit, data };
  
  console.log('Withdrawal Details:');
  console.log('  Nonce:', nonce.toString());
  console.log('  Sender:', sender);
  console.log('  Target:', target);
  console.log('  Value:', value.toString(), 'wei (', Number(value) / 1e18, 'ETH)');
  console.log('  Gas Limit:', gasLimit.toString());
  console.log('  Withdrawal Hash:', withdrawalHashFromLog);

  console.log('\n=== Step 3: Find Suitable Dispute Game ===');
  
  const disputeGameFactoryAddr = await l1Client.readContract({
    address: OPTIMISM_PORTAL_PROXY,
    abi: optimismPortalAbi,
    functionName: 'disputeGameFactory',
  });

  const gameCount = await l1Client.readContract({
    address: disputeGameFactoryAddr,
    abi: disputeGameFactoryAbi,
    functionName: 'gameCount',
  });

  let suitableGameIndex: bigint | null = null;
  let suitableGameProxy: `0x${string}` | null = null;
  let gameL2Block: bigint = 0n;

  for (let i = gameCount - 1n; i >= 0n && i >= gameCount - 50n; i--) {
    const game = await l1Client.readContract({
      address: disputeGameFactoryAddr,
      abi: disputeGameFactoryAbi,
      functionName: 'gameAtIndex',
      args: [i],
    });
    
    const [gameType, , gameProxy] = game;
    
    const l2BlockNumber = await l1Client.readContract({
      address: gameProxy,
      abi: disputeGameAbi,
      functionName: 'l2BlockNumber',
    });

    if (l2BlockNumber >= receipt.blockNumber) {
      suitableGameIndex = i;
      suitableGameProxy = gameProxy;
      gameL2Block = l2BlockNumber;
      console.log('Found suitable game at index', i.toString());
      console.log('  Game Proxy:', gameProxy);
      console.log('  L2 Block:', l2BlockNumber.toString());
      break;
    }
  }

  if (!suitableGameIndex || !suitableGameProxy) {
    throw new Error('No suitable dispute game found');
  }

  console.log('\n=== Step 4: Get Proofs from L2 ===');
  
  const l2BlockHex = '0x' + gameL2Block.toString(16);
  
  const withdrawalSlot = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, uint256'),
      [withdrawalHashFromLog, 0n]
    )
  );
  console.log('Storage slot for withdrawal:', withdrawalSlot);

  const proofResponse = await fetch('https://mainnet.megaeth.com/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getProof',
      params: [L2_TO_L1_MESSAGE_PASSER, [withdrawalSlot], l2BlockHex],
      id: 1,
    }),
  });
  
  const proofData = await proofResponse.json() as any;
  
  if (proofData.error) {
    console.log('Error getting proof:', proofData.error);
    throw new Error('Failed to get storage proof');
  }

  const accountProof = proofData.result.accountProof;
  const storageProof = proofData.result.storageProof[0];
  
  console.log('Storage value:', storageProof.value);
  console.log('Account proof nodes:', accountProof.length);
  console.log('Storage proof nodes:', storageProof.proof.length);

  console.log('\n=== Step 5: Get Block Header ===');
  
  const blockResponse = await fetch('https://mainnet.megaeth.com/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBlockByNumber',
      params: [l2BlockHex, false],
      id: 1,
    }),
  });
  
  const blockData = await blockResponse.json() as any;
  const block = blockData.result;
  
  console.log('Block hash:', block.hash);
  console.log('State root:', block.stateRoot);

  const messagePasserStorageRoot = proofData.result.storageHash;
  console.log('Message passer storage root:', messagePasserStorageRoot);

  console.log('\n=== Step 6: Build Output Root Proof ===');
  
  const outputRootProof = {
    version: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    stateRoot: block.stateRoot as `0x${string}`,
    messagePasserStorageRoot: messagePasserStorageRoot as `0x${string}`,
    latestBlockhash: block.hash as `0x${string}`,
  };

  console.log('Output Root Proof:');
  console.log('  Version:', outputRootProof.version);
  console.log('  State Root:', outputRootProof.stateRoot);
  console.log('  Message Passer Storage Root:', outputRootProof.messagePasserStorageRoot);
  console.log('  Latest Blockhash:', outputRootProof.latestBlockhash);

  const withdrawalProof = storageProof.proof as `0x${string}`[];
  console.log('\nWithdrawal proof length:', withdrawalProof.length);

  console.log('\n=== Step 7: Check if Already Proven ===');
  
  const computedHash = hashWithdrawal(withdrawal);
  console.log('Computed withdrawal hash:', computedHash);
  console.log('Hash from log:', withdrawalHashFromLog);

  try {
    const numSubmitters = await l1Client.readContract({
      address: OPTIMISM_PORTAL_PROXY,
      abi: optimismPortalAbi,
      functionName: 'numProofSubmitters',
      args: [withdrawalHashFromLog],
    });
    console.log('Number of proof submitters:', numSubmitters);
    
    if (numSubmitters > 0n) {
      console.log('\n⚠️ This withdrawal has already been proven!');
      console.log('You can skip to finalization after the challenge period.');
      return;
    }
  } catch (e) {
    console.log('Could not check proof status, proceeding...');
  }

  console.log('\n=== Step 8: Submit Proof Transaction ===');
  
  const balance = await l1Client.getBalance({ address: account.address });
  console.log('Account balance:', Number(balance) / 1e18, 'ETH');

  if (balance < 1000000000000000n) {
    console.log('⚠️ Low balance, may not have enough for gas');
  }

  console.log('\nSubmitting proveWithdrawalTransaction...');
  
  try {
    const { request } = await l1Client.simulateContract({
      address: OPTIMISM_PORTAL_PROXY,
      abi: optimismPortalAbi,
      functionName: 'proveWithdrawalTransaction',
      args: [
        withdrawal,
        suitableGameIndex,
        outputRootProof,
        withdrawalProof,
      ],
      account,
    });

    console.log('Simulation successful! Sending transaction...');

    const txHash = await walletClient.writeContract(request);
    console.log('\n✅ Proof transaction submitted!');
    console.log('TX Hash:', txHash);
    console.log('View on Etherscan: https://etherscan.io/tx/' + txHash);
    
  } catch (error: any) {
    console.log('\n❌ Transaction failed:');
    console.log(error.message || error);
    
    if (error.message?.includes('InvalidProof')) {
      console.log('\nThe proof is invalid. This could mean:');
      console.log('1. The block number used for proofs doesnt match the dispute game');
      console.log('2. The withdrawal hash calculation is incorrect');
      console.log('3. The storage slot calculation is wrong');
    }
  }
}

main().catch(console.error);
