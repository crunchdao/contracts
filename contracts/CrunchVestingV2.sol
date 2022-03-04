// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract CrunchVestingV2 is Ownable {
    event TokensReleased(uint256 amount);
    event TokenVestingRevoked();
    event CrunchTokenUpdate(address indexed previousCrunchToken, address indexed newCrunchToken);
    event BeneficiaryTransferred(address indexed previousBeneficiary, address indexed newBeneficiary);

    /* CRUNCH erc20 address. */
    IERC20Metadata public crunch;

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

    /** true if the vesting can be revoked. */
    bool public revokable;

    /** true if the vesting has been revoked. */
    bool public revoked;

    constructor(
        IERC20Metadata _crunch,
        address _beneficiary,
        uint256 _cliffDuration,
        uint256 _duration,
        bool _revokable
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
        revokable = _revokable;
    }
	
    /**
     * @notice Fake an ERC20-like contract allowing it to be displayed from wallets.
     * @return the contract 'fake' token name.
     */
    function name() external pure returns (string memory) {
        return "Vested CRUNCH Token (single)";
    }

    /**
     * @notice Fake an ERC20-like contract allowing it to be displayed from wallets.
     * @return the contract 'fake' token symbol.
     */
    function symbol() external pure returns (string memory) {
        return "svCRUNCH";
    }

    /**
     * @notice Fake an ERC20-like contract allowing it to be displayed from wallets.
     * @return the crunch's decimals value.
     */
    function decimals() external view returns (uint8) {
        return crunch.decimals();
    }

    /** @notice Transfers vested tokens to beneficiary. */
    function release() public {
        uint256 unreleased = releasableAmount();

        require(unreleased > 0, "Vesting: no tokens are due");

        released += unreleased;

        crunch.transfer(beneficiary, unreleased);

        emit TokensReleased(unreleased);
    }

    /** @notice Allows the owner to revoke the vesting. Tokens already vested remain in the contract, the rest are returned to the owner. */
    function revoke() public onlyOwner {
        require(revokable, "Vesting: token not revokable");
        require(!revoked, "Vesting: token already revoked");

        uint256 balance = crunch.balanceOf(address(this));

        uint256 unreleased = releasableAmount();
        uint256 refund = balance - unreleased;

        revoked = true;

        crunch.transfer(owner(), refund);

        emit TokenVestingRevoked();
    }

    function remainingAmount() public view returns (uint256) {
        return crunch.balanceOf(address(this));
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

    /**
     * @notice Get the remaining amount of token for the vesting.
     * @notice If the address is not the beneficiary, the method will return 0.
     * @dev This function is to make wallets able to display the amount in their UI.
     * @param addr Address to check.
     * @return The remaining amount of tokens.
     */
    function balanceOf(address addr) external view returns (uint256) {
        if (addr != beneficiary) {
			return 0;
		}

		return remainingAmount();
    }

    function setCrunch(IERC20Metadata newCrunch) external onlyOwner {
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
