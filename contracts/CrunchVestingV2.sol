// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CrunchVestingV2 is Ownable {
    event TokensReleased(uint256 amount);
    event CrunchTokenUpdate(address indexed previousCrunchToken, address indexed newCrunchToken);
    event BeneficiaryTransferred(address indexed previousBeneficiary, address indexed newBeneficiary);

    /* CRUNCH erc20 address. */
    IERC20 public crunch;

    /* beneficiary of tokens after they are released. */
    address public beneficiary;

    /** the start time of the token vesting. */
    uint256 public start;
    /** the cliff time of the token vesting. */
    uint256 public cliff;
    /** the duration of the token vesting. */
    uint256 public duration;

    /** the amount of the token released. */
    uint256 public released;

    constructor(
        IERC20 _crunch,
        address _beneficiary,
        uint256 _cliffDuration,
        uint256 _duration
    ) {
        require(
            _beneficiary != address(0),
            "Vesting: beneficiary is the zero address"
        );
        require(
            _cliffDuration <= _duration,
            "Vesting: cliff is longer than duration"
        );
        require(_duration > 0, "Vesting: duration is 0");

        crunch = _crunch;
        beneficiary = _beneficiary;
        start = block.timestamp;
        cliff = start + _cliffDuration;
        duration = _duration;
    }

    /** @notice Transfers vested tokens to beneficiary. */
    function release() public {
        uint256 unreleased = releasableAmount();

        require(unreleased > 0, "Vesting: no tokens are due");

        released += unreleased;

        crunch.transfer(beneficiary, unreleased);

        emit TokensReleased(unreleased);
    }

    /** @dev Calculates the amount that has already vested but hasn't been released yet. */
    function releasableAmount() public view returns (uint256) {
        return vestedAmount() - released;
    }

    /** @dev Calculates the amount that has already vested. */
    function vestedAmount() public view returns (uint256) {
        uint256 currentBalance = crunch.balanceOf(address(this));
        uint256 totalBalance = currentBalance + released;

        if (block.timestamp < cliff) {
            return 0;
        } else if ((block.timestamp >= start + duration)) {
            return totalBalance;
        } else {
            return (totalBalance * (block.timestamp - start)) / duration;
        }
    }

    function setCrunch(IERC20 newCrunch) external onlyOwner {
        require(
            address(newCrunch) != address(0),
            "Vesting: new crunch cannot be null"
        );

        require(
            crunch != newCrunch,
            "Vesting: token address cannot be updated to the same value"
        );

        address previousCrunch = address(crunch);
        
        crunch = newCrunch;

        emit CrunchTokenUpdate(previousCrunch, address(newCrunch));
    }

    /**
     * @dev Transfers benefeciary of the contract to a new account (`newBeneficiary`).
     * Can only be called by the current benefeciary.
     */
    function transferBeneficiary(address newBeneficiary) external onlyBeneficiary {
        require(
            newBeneficiary != address(0),
            "Vesting: beneficiary cannot be null"
        );
        require(
            beneficiary != newBeneficiary,
            "Vesting: beneficiary cannot be updated to the same value"
        );

        address previousBeneficiary = beneficiary;

        beneficiary = newBeneficiary;

        emit BeneficiaryTransferred(previousBeneficiary, newBeneficiary);
    }

    /** @dev Throws if called by any account other than the beneficiary. */
    modifier onlyBeneficiary() {
        require(beneficiary == _msgSender(), "Vesting: caller is not the beneficiary");
        _;
    }
}
