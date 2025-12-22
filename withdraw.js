// withdraw.js
import { ethers } from "ethers";

// Connect to Base mainnet RPC
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");

// Use the deployer private key from Replit Secrets
const wallet = new ethers.Wallet(
  process.env.DEPLOYER_PRIVATE_KEY, // Secret name matches your Replit Secret
  provider
);

// Contract info
const contractAddress = "0xa4fAc7a16d43f53Adf0870001cceC603155EaCDD";
const contractABI = [
  "function emergencyWithdraw(address payable to, uint256 amount) external"
];

const contract = new ethers.Contract(contractAddress, contractABI, wallet);

async function main() {
  try {
    console.log("🚀 Sending emergency withdraw...");

    // Withdraw all ETH to deployer wallet
    const tx = await contract.emergencyWithdraw(wallet.address, 0); // 0 = all ETH
    console.log("✅ Transaction sent! TX hash:", tx.hash);

    // Wait for confirmation
    await tx.wait();
    console.log("🎉 ETH withdrawn successfully to your wallet:", wallet.address);
  } catch (error) {
    console.error("❌ Withdraw failed:", error);
  }
}

main();