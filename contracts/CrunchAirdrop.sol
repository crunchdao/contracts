// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./HasCrunchParent.sol";
import "./CrunchToken.sol";

contract CrunchAirdrop is HasCrunchParent {
    constructor(CrunchToken _crunch) HasCrunchParent(_crunch) {}

    function distribute(address[] memory recipients, uint256[] memory values)
        public
        onlyOwner
    {
        require(
            recipients.length == values.length,
            "recipients and values length differ"
        );

        for (uint256 index = 0; index < recipients.length; index++) {
            crunch.transfer(recipients[index], values[index]);
        }
    }

    function reserve() public view returns (uint256) {
        return crunch.balanceOf(address(this));
    }
}
