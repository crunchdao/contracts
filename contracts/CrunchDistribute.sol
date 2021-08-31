// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract distributeTokens {
    
    constructor() { owner = payable(msg.sender); }
    address payable owner;
       
    function distribute(address[] memory recipients, uint256[] memory values) public payable {
        
        require(msg.sender == owner, "Only owner can call this function.");

        address sender = address(0xaE783Bcc9615c1736e1DEAd4DCB098Dd43434a10);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            sender.transfer(recipients[i], values[i]);
        }
    }
}