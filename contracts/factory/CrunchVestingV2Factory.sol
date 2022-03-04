// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../CrunchVestingV2.sol";

contract CrunchVestingV2Factory is Ownable {
    event Created(
        CrunchVestingV2 indexed vesting,
        address indexed beneficiary,
        uint256 cliffDuration,
        uint256 duration,
        bool revokable
    );

    /* CRUNCH erc20 address. */
    IERC20Metadata public crunch;

    mapping(address => CrunchVestingV2[]) public createdVestings;

    constructor(IERC20Metadata _crunch) {
        crunch = _crunch;
    }

    function create(
        address beneficiary,
        uint256 cliffDuration,
        uint256 duration,
        bool revokable
    ) public onlyOwner returns (CrunchVestingV2 vesting) {
        vesting = new CrunchVestingV2(
            crunch,
            beneficiary,
            cliffDuration,
            duration,
            revokable
        );

        vesting.transferOwnership(owner());

        emit Created(vesting, beneficiary, cliffDuration, duration, revokable);

		createdVestings[beneficiary].push(vesting);
    }

    /**
     * @notice Get the sum of remaining amount of token for each vesting of a beneficiary.
     * @dev This function is to make wallets able to display the amount in their UI.
     * @param beneficiary Address to check.
     * @return total The sum of all remaining amount of tokens.
     */
    function balanceOf(address beneficiary)
        external
        view
        returns (uint256 total)
    {
        CrunchVestingV2[] storage vestings = createdVestings[beneficiary];

        for (uint256 index = 0; index < vestings.length; ++index) {
            CrunchVestingV2 vesting = vestings[index];

            total += vesting.balanceOf(beneficiary);
        }
    }

    function emptyReserve() public onlyOwner returns (uint256 balance) {
        balance = crunch.balanceOf(address(this));

        if (balance == 0) {
            revert("Vesting Factory: reserve is already empty");
        }

        crunch.transfer(owner(), balance);
    }
}
