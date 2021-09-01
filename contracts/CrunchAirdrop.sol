// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./HasCrunchParent.sol";
import "./CrunchToken.sol";

contract CrunchAirdrop is HasCrunchParent {
    constructor(CrunchToken _crunch) HasCrunchParent(_crunch) {}

    /**
     * @dev Distribute tokens.
     *
     * Requirements:
     *
     * - `recipients` and `values` are the same length.
     * - the reserve has enough to cover the sum of `values`.
     */
    function distribute(address[] memory recipients, uint256[] memory values)
        public
        onlyOwner
    {
        require(
            recipients.length == values.length,
            "recipients and values length differ"
        );

        require(
            reserve() >= sum(values),
            "the reserve does not have enough token"
        );

        for (uint256 index = 0; index < recipients.length; index++) {
            crunch.transfer(recipients[index], values[index]);
        }
    }

    /** @dev Returns the current balance of the contract. */
    function reserve() public view returns (uint256) {
        return crunch.balanceOf(address(this));
    }

    /** @dev Returns the sum of each value in `values`. */
    function sum(uint256[] memory values)
        internal
        pure
        returns (uint256 accumulator)
    {
        for (uint256 index = 0; index < values.length; index++) {
            accumulator += values[index];
        }
    }
}
