import { createPublicClient, createWalletClient, http, parseAbi, keccak256, encodeAbiParameters, parseAbiParameters, decodeAbiParameters, concat, toHex, pad, numberToHex, hexToBigInt } from 'viem';
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
]);

const disputeGameFactoryAbi = parseAbi([
  'function gameCount() view returns (uint256)',
  'function gameAtIndex(uint256 _index) view returns (uint32 gameType, uint64 timestamp, address proxy)',
]);

const disputeGameAbi = parseAbi([
  'function rootClaim() view returns (bytes32)',
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
  if (!privateKey) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
  console.log('Account:', account.address);

  const l1Client = createPublicClient({ chain: mainnet, transport: http('https://eth.llamarpc.com') });
  const l2Client = createPublicClient({ chain: megaethChain as any, transport: http('https://mainnet.megaeth.com/rpc') });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http('https://eth.llamarpc.com') });

  console.log('\n=== Get L2 Transaction ===');
  const receipt = await l2Client.getTransactionReceipt({ hash: L2_TX_HASH });
  console.log('Block:', receipt.blockNumber);

  const messagePassedEventSig = '0x02a52367d10742d8032712c1bb8e0144ff1ec5ffda1ed7d70bb05a2744955054';
  const messageLog = receipt.logs.find(
    log => log.address.toLowerCase() === L2_TO_L1_MESSAGE_PASSER.toLowerCase() && log.topics[0] === messagePassedEventSig
  );
  if (!messageLog) throw new Error('No MessagePassed event');

  const nonce = BigInt(messageLog.topics[1]!);
  const sender = ('0x' + messageLog.topics[2]!.slice(26)) as `0x${string}`;
  const target = ('0x' + messageLog.topics[3]!.slice(26)) as `0x${string}`;

  const decoded = decodeAbiParameters(
    parseAbiParameters('uint256 value, uint256 gasLimit, bytes data, bytes32 withdrawalHash'),
    messageLog.data as `0x${string}`
  );
  
  const value = decoded[0];
  const gasLimit = decoded[1];
  const data = decoded[2] as `0x${string}`;
  const withdrawalHashFromLog = decoded[3] as `0x${string}`;

  const withdrawal = { nonce, sender, target, value, gasLimit, data };
  
  console.log('\nWithdrawal:');
  console.log('  Nonce:', nonce.toString());
  console.log('  Sender:', sender);
  console.log('  Target:', target);
  console.log('  Value:', Number(value) / 1e18, 'ETH');
  console.log('  Gas:', gasLimit.toString());
  console.log('  Data length:', data.length);
  
  const computedHash = hashWithdrawal(withdrawal);
  console.log('\n  Hash from log:', withdrawalHashFromLog);
  console.log('  Computed hash:', computedHash);
  console.log('  Match:', withdrawalHashFromLog === computedHash);

  console.log('\n=== Find Dispute Game ===');
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
    const [, , gameProxy] = await l1Client.readContract({
      address: disputeGameFactoryAddr,
      abi: disputeGameFactoryAbi,
      functionName: 'gameAtIndex',
      args: [i],
    });
    
    const l2BlockNumber = await l1Client.readContract({
      address: gameProxy,
      abi: disputeGameAbi,
      functionName: 'l2BlockNumber',
    });

    if (l2BlockNumber >= receipt.blockNumber) {
      suitableGameIndex = i;
      suitableGameProxy = gameProxy;
      gameL2Block = l2BlockNumber;
      console.log('Game index:', i.toString(), '-> block', l2BlockNumber.toString());
      break;
    }
  }

  if (!suitableGameIndex || !suitableGameProxy) throw new Error('No game');

  console.log('\n=== Build Output Root Proof ===');
  const gameBlock = await l2Client.getBlock({ blockNumber: gameL2Block });
  
  const rootClaim = await l1Client.readContract({
    address: suitableGameProxy,
    abi: disputeGameAbi,
    functionName: 'rootClaim',
  });

  const outputRootProof = {
    version: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    stateRoot: gameBlock.stateRoot as `0x${string}`,
    messagePasserStorageRoot: (gameBlock as any).withdrawalsRoot as `0x${string}`,
    latestBlockhash: gameBlock.hash as `0x${string}`,
  };

  const computedOutputRoot = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, bytes32, bytes32, bytes32'),
      [outputRootProof.version, outputRootProof.stateRoot, outputRootProof.messagePasserStorageRoot, outputRootProof.latestBlockhash]
    )
  );
  
  console.log('rootClaim:', rootClaim);
  console.log('computed:', computedOutputRoot);
  console.log('Match:', rootClaim === computedOutputRoot);

  console.log('\n=== Storage Proof Calculation ===');
  const sentMessageSlot = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, uint256'),
      [withdrawalHashFromLog, 0n]
    )
  );
  console.log('Storage slot:', sentMessageSlot);

  console.log('\n=== Try Different RPC Methods ===');
  
  const methods = [
    'debug_storageRangeAt',
    'debug_accountRange', 
    'eth_getStorageAt',
    'mega_getProof',
    'mega_getStorageProof',
  ];
  
  for (const method of methods) {
    try {
      const resp = await fetch('https://mainnet.megaeth.com/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params: method === 'eth_getStorageAt' 
            ? [L2_TO_L1_MESSAGE_PASSER, sentMessageSlot, '0x' + gameL2Block.toString(16)]
            : [L2_TO_L1_MESSAGE_PASSER, [sentMessageSlot], '0x' + gameL2Block.toString(16)],
          id: 1,
        }),
      });
      const data = await resp.json() as any;
      if (data.error) {
        console.log(`${method}: not supported`);
      } else {
        console.log(`${method}: SUCCESS!`, data.result);
      }
    } catch (e) {
      console.log(`${method}: error`);
    }
  }

  console.log('\n=== Account Balance ===');
  const balance = await l1Client.getBalance({ address: account.address });
  console.log('L1 ETH:', Number(balance) / 1e18);
}

main().catch(console.error);
