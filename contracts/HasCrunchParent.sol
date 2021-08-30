// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./CrunchToken.sol";

contract HasCrunchParent is Ownable {
    event ParentUpdated(CrunchToken from, CrunchToken to);

    CrunchToken public crunch;

    constructor(CrunchToken _crunch) {
        crunch = _crunch;
    }

    modifier onlyCrunchParent() {
        require(
            address(crunch) == _msgSender(),
            "HasCrunchParent: caller is not the crunch token"
        );
        _;
    }

    function setCrunch(CrunchToken _crunch) public onlyOwner {
        require(crunch != _crunch, "useless to update to same crunch token");

        emit ParentUpdated(crunch, _crunch);

        crunch = _crunch;
    }
}
