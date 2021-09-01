// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./TokenVesting.sol";

contract CrunchVesting is TokenVesting {
    constructor(address beneficiary, uint256 cliffDurationInYear, uint256 durationInYear) public
        TokenVesting(beneficiary, block.timestamp, cliffDurationInYear * 365.25 days, durationInYear * 365.25 days, true) {
    }
}
