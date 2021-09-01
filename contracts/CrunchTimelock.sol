// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/utils/TokenTimelock.sol";

import "./CrunchToken.sol";

contract CrunchTimelock is TokenTimelock {
    constructor(
        CrunchToken crunch,
        address beneficiary,
        uint256 releaseTimeInYear
    ) TokenTimelock(crunch, beneficiary, releaseTimeInYear * 365.25 days) {}
}
