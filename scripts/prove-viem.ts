import { createPublicClient, createWalletClient, http, parseAbi, keccak256, encodeAbiParameters, parseAbiParameters, toHex } from 'viem';
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
  blockExplorers: { default: { name: 'MegaETH Explorer', url: 'https://megaeth.blockscout.com' } },
};

const optimismPortalAbi = parseAbi([
  'function respectedGameType() view returns (uint32)',
  'function disputeGameFactory() view returns (address)',
  'function proveWithdrawalTransaction((uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data) _tx, uint256 _disputeGameIndex, (bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash) _outputRootProof, bytes[] _withdrawalProof) external',
  'function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)',
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
  
  const value = BigInt('0x' + messageLog.data.slice(2, 66));
  const gasLimit = BigInt('0x' + messageLog.data.slice(66, 130));
  
  const dataOffset = 130;
  const dataLengthHex = messageLog.data.slice(194, 258);
  const dataLength = Number(BigInt('0x' + dataLengthHex)) * 2;
  const data = ('0x' + messageLog.data.slice(258, 258 + dataLength)) as `0x${string}`;
  
  const withdrawalHashFromLog = ('0x' + messageLog.data.slice(-64)) as `0x${string}`;
  
  const withdrawal = { nonce, sender, target, value, gasLimit, data };
  
  console.log('Withdrawal Details:');
  console.log('  Nonce:', nonce.toString());
  console.log('  Sender:', sender);
  console.log('  Target:', target);
  console.log('  Value:', value.toString(), 'wei (', Number(value) / 1e18, 'ETH)');
  console.log('  Gas Limit:', gasLimit.toString());
  console.log('  Withdrawal Hash:', withdrawalHashFromLog);

  console.log('\n=== Step 3: Find Dispute Game ===');
  
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

  console.log('Total dispute games:', gameCount);

  let suitableGameIndex: bigint | null = null;
  let suitableGameProxy: `0x${string}` | null = null;
  let gameL2Block: bigint = 0n;

  for (let i = gameCount - 1n; i >= 0n && i >= gameCount - 100n; i--) {
    const game = await l1Client.readContract({
      address: disputeGameFactoryAddr,
      abi: disputeGameFactoryAbi,
      functionName: 'gameAtIndex',
      args: [i],
    });
    
    const [, , gameProxy] = game;
    
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
      console.log('  Proxy:', gameProxy);
      console.log('  L2 Block:', l2BlockNumber.toString());
      break;
    }
  }

  if (!suitableGameIndex || !suitableGameProxy) {
    throw new Error('No suitable dispute game found');
  }

  console.log('\n=== Step 4: Get Block Data for Proof ===');
  
  const gameBlock = await l2Client.getBlock({ blockNumber: gameL2Block });
  console.log('Game block hash:', gameBlock.hash);
  console.log('Game block stateRoot:', gameBlock.stateRoot);
  console.log('Game block withdrawalsRoot:', (gameBlock as any).withdrawalsRoot);

  const withdrawalBlock = await l2Client.getBlock({ blockNumber: receipt.blockNumber });
  console.log('\nWithdrawal block hash:', withdrawalBlock.hash);
  console.log('Withdrawal block stateRoot:', withdrawalBlock.stateRoot);
  console.log('Withdrawal block withdrawalsRoot:', (withdrawalBlock as any).withdrawalsRoot);

  const rootClaim = await l1Client.readContract({
    address: suitableGameProxy,
    abi: disputeGameAbi,
    functionName: 'rootClaim',
  });
  console.log('\nDispute game rootClaim:', rootClaim);

  console.log('\n=== Step 5: Build Output Root Proof ===');
  
  const outputRootProof = {
    version: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    stateRoot: gameBlock.stateRoot as `0x${string}`,
    messagePasserStorageRoot: (gameBlock as any).withdrawalsRoot as `0x${string}`,
    latestBlockhash: gameBlock.hash as `0x${string}`,
  };

  console.log('Output Root Proof:');
  console.log('  version:', outputRootProof.version);
  console.log('  stateRoot:', outputRootProof.stateRoot);
  console.log('  messagePasserStorageRoot:', outputRootProof.messagePasserStorageRoot);
  console.log('  latestBlockhash:', outputRootProof.latestBlockhash);

  const computedOutputRoot = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, bytes32, bytes32, bytes32'),
      [
        outputRootProof.version,
        outputRootProof.stateRoot,
        outputRootProof.messagePasserStorageRoot,
        outputRootProof.latestBlockhash,
      ]
    )
  );
  console.log('\nComputed output root:', computedOutputRoot);
  console.log('Dispute game rootClaim:', rootClaim);
  console.log('Match:', computedOutputRoot === rootClaim);

  console.log('\n=== Step 6: Storage Proof ===');
  
  const withdrawalSlot = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, uint256'),
      [withdrawalHashFromLog, 0n]
    )
  );
  console.log('Withdrawal storage slot:', withdrawalSlot);

  console.log('\nSince eth_getProof is not supported, we need an alternative...');
  console.log('The withdrawalsRoot in block header IS the L2ToL1MessagePasser storage root.');
  console.log('');
  console.log('For proving without eth_getProof, the MegaETH team needs to either:');
  console.log('1. Enable eth_getProof on their RPC');
  console.log('2. Provide an alternative proof endpoint');
  console.log('3. Provide an official bridge UI that handles proving');
  console.log('');
  console.log('Contact MegaETH support/Discord for assistance.');

  console.log('\n=== Account Balance ===');
  const balance = await l1Client.getBalance({ address: account.address });
  console.log('L1 ETH:', Number(balance) / 1e18, 'ETH');
}

main().catch(console.error);
