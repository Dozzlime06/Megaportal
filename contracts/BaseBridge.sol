// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BaseBridge
 * @notice Simple bridge deposit contract for Base -> MegaETH bridging
 * @dev Users deposit ETH on Base, owner manually sends ETH on MegaETH
 */
contract BaseBridge {
    address public owner;
    bool public paused;
    uint256 public nonce;
    
    uint256 public constant MIN_DEPOSIT = 0;
    uint256 public constant MAX_DEPOSIT = 100 ether;
    
    event DepositRequested(
        address indexed user,
        uint256 amount,
        uint256 destinationChainId,
        uint256 nonce,
        uint256 timestamp
    );
    
    event EmergencyWithdraw(
        address indexed to,
        uint256 amount
    );
    
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    
    event Paused(address account);
    event Unpaused(address account);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier nonReentrant() {
        require(nonce != type(uint256).max, "Reentrancy");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        paused = false;
        nonce = 0;
    }
    
    /**
     * @notice Deposit ETH to bridge to MegaETH
     * @dev Emits DepositRequested event for off-chain processing
     */
    function deposit() external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Amount must be greater than 0");
        require(msg.value <= MAX_DEPOSIT, "Above maximum deposit");
        
        uint256 currentNonce = nonce;
        nonce++;
        
        emit DepositRequested(
            msg.sender,
            msg.value,
            4326, // MegaETH Chain ID
            currentNonce,
            block.timestamp
        );
    }
    
    /**
     * @notice Emergency withdrawal by owner
     * @param to Address to send funds to
     * @param amount Amount to withdraw (0 for all)
     */
    function emergencyWithdraw(address payable to, uint256 amount) external onlyOwner {
        uint256 withdrawAmount = amount == 0 ? address(this).balance : amount;
        require(withdrawAmount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = to.call{value: withdrawAmount}("");
        require(success, "Transfer failed");
        
        emit EmergencyWithdraw(to, withdrawAmount);
    }
    
    /**
     * @notice Pause deposits
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }
    
    /**
     * @notice Unpause deposits
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    /**
     * @notice Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice Receive ETH directly (calls deposit)
     */
    receive() external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        require(msg.value <= MAX_DEPOSIT, "Above maximum deposit");
        require(!paused, "Contract is paused");
        
        uint256 currentNonce = nonce;
        nonce++;
        
        emit DepositRequested(
            msg.sender,
            msg.value,
            4326,
            currentNonce,
            block.timestamp
        );
    }
}
