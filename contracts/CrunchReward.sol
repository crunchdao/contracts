// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./CrunchAirdrop.sol";

contract CrunchReward is CrunchAirdrop {
    constructor(CrunchToken _crunch) CrunchAirdrop(_crunch) {}
}
