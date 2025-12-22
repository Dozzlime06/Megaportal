# Fees

MegaBridge charges minimal fees to cover operational costs.

## Fee Structure

### Bridge Fee
- **Rate**: 0.1% of the bridged amount
- **Example**: Bridging 1 ETH = 0.001 ETH fee

### Slippage
- **Rate**: 0.05% (5 basis points)
- **Purpose**: Accounts for price fluctuations during processing

### Gas Fees
- **Source Chain**: You pay gas fees on the source network for the deposit transaction
- **Destination Chain**: Gas fees for fulfillment are covered by the bridge operator

## Fee Calculation Example

If you bridge **1 ETH** from Base to MegaETH:

| Component | Amount |
|-----------|--------|
| Input Amount | 1.0000 ETH |
| Bridge Fee (0.1%) | -0.0010 ETH |
| Slippage (0.05%) | -0.0005 ETH |
| **Output Amount** | **0.9985 ETH** |

## Viewing Fees

Before confirming any bridge transaction, you'll see a detailed breakdown showing:
- Input amount
- Slippage amount and percentage
- Bridge fee amount and percentage
- Estimated output amount
- Estimated processing time

## No Hidden Fees

MegaBridge is transparent about all fees. What you see in the quote is exactly what you'll pay. There are no hidden charges or surprise deductions.
