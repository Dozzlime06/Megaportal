# MegaBridge Smart Contracts

## BaseBridge.sol

This is the deposit contract deployed on **Base mainnet** for the Base → MegaETH bridge.

### Features

- **Deposit ETH**: Users can deposit ETH to bridge to MegaETH
- **Emergency Withdrawal**: Owner can withdraw all funds in case of emergency
- **Pause/Unpause**: Owner can pause deposits if needed
- **Events**: All deposits emit events for off-chain tracking

### Contract Details

| Property | Value |
|----------|-------|
| Min Deposit | 0.001 ETH |
| Max Deposit | 100 ETH |
| Destination Chain ID | 4326 (MegaETH) |

### Deployment Instructions

1. **Using Remix IDE:**
   - Go to https://remix.ethereum.org
   - Create new file `BaseBridge.sol` and paste the contract code
   - Compile with Solidity 0.8.20+
   - Deploy to Base mainnet
   - Save the deployed contract address

2. **After Deployment:**
   - Update the platform with the contract address
   - The platform will listen for `DepositRequested` events
   - When deposits are detected, manually send ETH to users on MegaETH

### Functions

#### For Users
- `deposit()` - Deposit ETH to bridge (payable)
- `receive()` - Allows sending ETH directly to contract

#### For Owner
- `emergencyWithdraw(address to, uint256 amount)` - Withdraw funds
- `pause()` - Pause deposits
- `unpause()` - Resume deposits
- `transferOwnership(address newOwner)` - Transfer ownership

### Events

```solidity
event DepositRequested(
    address indexed user,
    uint256 amount,
    uint256 destinationChainId,
    uint256 nonce,
    uint256 timestamp
);
```

### Security Considerations

1. Only the owner can withdraw funds
2. Contract can be paused in emergencies
3. Min/Max deposit limits prevent abuse
4. Nonce prevents replay attacks

### Bridge Flow

```
1. User deposits ETH on Base → Contract
2. DepositRequested event is emitted
3. Platform backend detects event
4. Platform shows "30 min wait" to user
5. Owner manually sends ETH on MegaETH
6. Platform marks transaction as completed
```
