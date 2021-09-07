// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../CrunchVesting.sol";

contract CrunchVestingFactory is HasCrunchParent {
    event Created(CrunchVesting indexed vesting);

    uint256 public constant oneYear = 365.25 days;

    constructor(CrunchToken crunch) HasCrunchParent(crunch) {}

    function create(
        address beneficiary,
        uint256 cliffDuration,
        uint256 duration
    ) public onlyOwner returns (CrunchVesting vesting) {
        vesting = new CrunchVesting(
            crunch,
            beneficiary,
            cliffDuration,
            duration
        );

        emit Created(vesting);
    }

    function createSimple(address beneficiary)
        public
        onlyOwner
        returns (CrunchVesting)
    {
        return create(beneficiary, oneYear, oneYear * 4);
    }
}
