// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../CrunchVesting.sol";

contract CrunchVestingFactory is HasCrunchParent {
    uint256 public constant oneYear = 365.25 days;

    constructor(CrunchToken crunch) HasCrunchParent(crunch) {}

    function create(
        address beneficiary,
        uint256 cliffDuration,
        uint256 duration
    ) public returns (CrunchVesting) {
        return new CrunchVesting(crunch, beneficiary, cliffDuration, duration);
    }

    function createSimple(address beneficiary) public returns (CrunchVesting) {
        return create(beneficiary, oneYear, oneYear * 4);
    }
}
