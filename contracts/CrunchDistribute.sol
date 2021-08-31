// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./HasCrunchParent.sol";
import "./CrunchToken.sol";

contract CrunchDistribute is HasCrunchParent {
    constructor(CrunchToken _crunch) HasCrunchParent(_crunch) {}

    function distribute(address[] memory recipients, uint256[] memory values)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < recipients.length; i++) {
            crunch.transfer(recipients[i], values[i]);
        }
    }
}
