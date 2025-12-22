# How It Works

## Bridge Architecture

MegaBridge uses a secure, manual fulfillment architecture to ensure the safety of your funds.

### Bridge In (Base → MegaETH)

1. **Deposit**: You send ETH to the MegaBridge smart contract on Base
2. **Detection**: The platform detects your deposit and records the transaction
3. **Fulfillment**: The bridge operator manually sends the equivalent ETH (minus fees) to your address on MegaETH
4. **Confirmation**: You receive your ETH on MegaETH

### Bridge Out (MegaETH → Base)

1. **Deposit**: You send ETH to the designated bridge address on MegaETH
2. **Detection**: The platform detects your deposit
3. **Fulfillment**: The bridge operator sends the equivalent ETH (minus fees) to your address on Base
4. **Confirmation**: You receive your ETH on Base

## Smart Contract

The MegaBridge smart contract on Base handles:
- Receiving deposits
- Recording depositor addresses
- Emergency withdrawal functionality (owner only)
- Pause/unpause functionality for maintenance

### Contract Address (Base Mainnet)
```
0xa4fac7a16d43f53adf0870001ccec603155eacdd
```

## Security Features

- **Manual Fulfillment**: All transfers are manually verified and fulfilled, reducing smart contract risk
- **Emergency Withdrawal**: Contract owner can recover funds in case of emergency
- **Pause Functionality**: Bridge can be paused if any issues are detected
- **No Private Key Exposure**: Your wallet keys never leave your device

## Processing Time

Bridge transfers typically take approximately **30 minutes** to complete. This time allows for:
- Transaction confirmation on the source chain
- Manual verification by the bridge operator
- Transaction submission on the destination chain
