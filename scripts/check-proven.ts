import { createPublicClient, http, parseAbi, keccak256 } from 'viem';
import { mainnet } from 'viem/chains';

const L1_RPC = 'https://ethereum-rpc.publicnode.com';
const OPTIMISM_PORTAL = '0x7f82f57F0Dd546519324392e408b01fcC7D709e8';

async function main() {
  const l1Client = createPublicClient({ chain: mainnet, transport: http(L1_RPC) });
  
  const withdrawals = [
    { 
      name: '0.0002 ETH withdrawal',
      hash: '0x69ac8f49c3156b5f312e18e49def4c2203834876f7691a77a40005fc4ad1a817',
      submitter: '0x0315eCb53F64b7A4bA56bb8A4DAB0D96F0856b60' // Your wallet
    },
    { 
      name: '0.0001 ETH withdrawal',
      hash: '0x8366d51e9678ce6f112f2d7a8f5c481f62f1fd23c79b9abfb949c66d732f82fd',
      submitter: '0xeda81dd9a3a620b7e9bd550b4d90503dafefbf5f' // Other wallet
    }
  ];
  
  console.log('=== Checking Proven Withdrawals on L1 ===\n');
  
  for (const w of withdrawals) {
    console.log(`${w.name}:`);
    console.log(`  Hash: ${w.hash}`);
    
    try {
      // Check provenWithdrawals mapping
      // In OptimismPortal2, it's provenWithdrawals(withdrawalHash, proofSubmitter) => (disputeGameProxy, timestamp)
      const proofKey = keccak256(`${w.hash}${w.submitter.slice(2).toLowerCase().padStart(64, '0')}` as `0x${string}`);
      
      const proven = await l1Client.readContract({
        address: OPTIMISM_PORTAL as `0x${string}`,
        abi: parseAbi(['function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)']),
        functionName: 'provenWithdrawals',
        args: [w.hash as `0x${string}`, w.submitter as `0x${string}`]
      });
      
      console.log(`  Proven: ${proven[1] > 0n ? 'YES ✓' : 'NO ✗'}`);
      if (proven[1] > 0n) {
        console.log(`  Dispute Game: ${proven[0]}`);
        console.log(`  Timestamp: ${new Date(Number(proven[1]) * 1000).toISOString()}`);
      }
    } catch (e: any) {
      console.log(`  Error checking: ${e.message}`);
    }
    console.log('');
  }
  
  // Also check finalized
  console.log('=== Checking Finalized Withdrawals ===\n');
  for (const w of withdrawals) {
    try {
      const finalized = await l1Client.readContract({
        address: OPTIMISM_PORTAL as `0x${string}`,
        abi: parseAbi(['function finalizedWithdrawals(bytes32) view returns (bool)']),
        functionName: 'finalizedWithdrawals',
        args: [w.hash as `0x${string}`]
      });
      console.log(`${w.name}: Finalized = ${finalized ? 'YES ✓' : 'NO ✗'}`);
    } catch (e: any) {
      console.log(`${w.name}: Error - ${e.message}`);
    }
  }
}

main().catch(console.error);
