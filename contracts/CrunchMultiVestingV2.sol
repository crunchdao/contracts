// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title Crunch Multi Vesting V2
 * @author Enzo CACERES <enzo.caceres@crunchdao.com>
 * @notice Allow the vesting of multiple users using only one contract.
 */
contract CrunchMultiVestingV2 is Ownable {
    // prettier-ignore
    event TokensReleased(
        address indexed beneficiary,
        uint256 amount
    );

    // prettier-ignore
    event CrunchTokenUpdated(
        address indexed oldAddress,
        address indexed newAddress
    );

    // prettier-ignore
    event VestingCreated(
        address indexed beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 duration,
        bool revocable
    );

    // prettier-ignore
    event VestingRevoked(
        address indexed beneficiary,
        uint256 refund
    );

    // prettier-ignore
    event VestingTransfered(
        address indexed from,
        address indexed to
    );

    // prettier-ignore
    event VestingCleared(
        address indexed beneficiary
    );

    struct Vesting {
        address beneficiary;
        /** the amount of token to vest. */
        uint256 amount;
        /** the cliff time of the token vesting. */
        uint256 cliffDuration;
        /** the duration of the token vesting. */
        uint256 duration;
        bool revocable;
        bool revoked;
        /** the amount of the token released. */
        uint256 released;
    }

    /* CRUNCH erc20 address. */
    IERC20Metadata public crunch;

    /** currently locked tokens that are being used by all of the vestings */
    uint256 public totalSupply;

    uint256 public startDate;

    /** mapping to vesting list */
    mapping(address => Vesting) public vestings;

    /**
     * @notice Instanciate a new contract.
     * @param crunch_ CRUNCH token address.
     */
    constructor(address crunch_) {
        _setCrunch(crunch_);
    }

    /**
     * @notice Fake an ERC20-like contract allowing it to be displayed from wallets.
     * @return the contract 'fake' token name.
     */
    function name() external pure returns (string memory) {
        return "Vested CRUNCH Token v2 (multi)";
    }

    /**
     * @notice Fake an ERC20-like contract allowing it to be displayed from wallets.
     * @return the contract 'fake' token symbol.
     */
    function symbol() external pure returns (string memory) {
        return "mvCRUNCH.2";
    }

    /**
     * @notice Fake an ERC20-like contract allowing it to be displayed from wallets.
     * @return the crunch's decimals value.
     */
    function decimals() external view returns (uint8) {
        return crunch.decimals();
    }

    /**
     * @notice Get the current reserve (or balance) of the contract in CRUNCH.
     * @return The balance of CRUNCH this contract has.
     */
    function reserve() public view returns (uint256) {
        return crunch.balanceOf(address(this));
    }

    /**
     * @notice Get the available reserve.
     * @return The number of CRUNCH that can be used to create another vesting.
     */
    function availableReserve() public view returns (uint256) {
        return reserve() - totalSupply;
    }

    function begin() external onlyOwner onlyWhenNotStarted {
        startDate = block.timestamp;
    }

    /**
     * @notice Create a new vesting.
     *
     * Requirements:
     * - caller must be the owner
     * - `amount` must not be zero
     * - `beneficiary` must not be the null address
     * - `cliffDuration` must be less than the duration
     * - `duration` must not be zero
     * - there must be enough available reserve to accept the amount
     *
     * @dev A `VestingCreated` event will be emitted.
     * @param beneficiary Address that will receive CRUNCH tokens.
     * @param amount Amount of CRUNCH to vest.
     * @param cliffDuration Cliff duration in seconds.
     * @param duration Vesting duration in seconds.
     */
    function create(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 duration,
        bool revocable
    ) external onlyOwner onlyWhenNotStarted {
        require(beneficiary != address(0), "MultiVesting: beneficiary is the zero address");
        require(!isVested(beneficiary), "MultiVesting: beneficiary is already vested");
        require(amount > 0, "MultiVesting: amount is 0");
        require(duration > 0, "MultiVesting: duration is 0");
        require(cliffDuration <= duration, "MultiVesting: cliff is longer than duration");
        require(availableReserve() >= amount, "MultiVesting: available reserve is not enough");

        // prettier-ignore
        vestings[beneficiary] = Vesting({
            beneficiary: beneficiary,
            amount: amount,
            cliffDuration: cliffDuration,
            duration: duration,
            revocable: revocable,
            revoked: false,
            released: 0
        });

        totalSupply += amount;

        emit VestingCreated(beneficiary, amount, cliffDuration, duration, revocable);
    }

    function transfer(address to) external {
        address from = _msgSender();

        require(isVested(from), "MultiVesting: not currently vesting");
        require(!isVested(to), "MultiVesting: new beneficiary is already vested");

        vestings[to] = vestings[from];
        vestings[to].beneficiary = to;
        
        delete vestings[from];

        emit VestingTransfered(from, to);
    }

    /**
     * @notice Release a vesting of the current caller.
     * @dev A `TokensReleased` event will be emitted.
     * @dev The transaction will fail if no token are due.
     */
    function release() external returns (uint256) {
        return _release(_msgSender());
    }

    /**
     * @notice Release a vesting of a specified address.
     * @dev The caller must be the owner.
     * @dev A `TokensReleased` event will be emitted.
     * @dev The transaction will fail if no token are due.
     * @param beneficiary Address to release.
     */
    function releaseFor(address beneficiary) external onlyOwner returns (uint256) {
        return _release(beneficiary);
    }

    function revoke(address beneficiary) public onlyOwner {
        Vesting storage vesting = _getVesting(beneficiary);

        require(vesting.revocable, "MultiVesting: token not revocable");
        require(!vesting.revoked, "MultiVesting: token already revoked");

        uint256 unreleased = _releasableAmount(vesting);
        uint256 refund = vesting.amount - unreleased;

        vesting.revoked = true;

        crunch.transfer(owner(), refund);
        vesting.amount -= refund;

        emit VestingRevoked(beneficiary, refund);
    }

    function clear() external {
        _clear(_msgSender());
    }

    function clearFor(address beneficiary) external onlyOwner {
        _clear(beneficiary);
    }

    /**
     * @notice Get the releasable amount of tokens.
     * @param beneficiary Address to check.
     * @return The releasable amounts.
     */
    function releasableAmount(address beneficiary) public view returns (uint256) {
        Vesting storage vesting = _getVesting(beneficiary);

        return _releasableAmount(vesting);
    }

    /**
     * @notice Get the vested amount of tokens.
     * @param beneficiary Address to check.
     * @return The vested amount of the vestings.
     */
    function vestedAmount(address beneficiary) public view returns (uint256) {
        Vesting storage vesting = _getVesting(beneficiary);

        return _vestedAmount(vesting);
    }

    /**
     * @notice Get the remaining amount of token of a beneficiary.
     * @dev This function is to make wallets able to display the amount in their UI.
     * @param beneficiary Address to check.
     * @return The remaining amount of tokens.
     */
    function balanceOf(address beneficiary) external view returns (uint256) {
        Vesting storage vesting = _getVesting(beneficiary);

        return vesting.amount - vesting.released;
    }

    function isVested(address beneficiary) public view returns (bool) {
        return vestings[beneficiary].duration != 0;
    }

    /**
     * @notice Update the CRUNCH token address.
     * @dev The caller must be the owner.
     * @dev A `CrunchTokenUpdated` event will be emitted.
     * @param newCrunch New CRUNCH token address.
     */
    function setCrunch(address newCrunch) external onlyOwner {
        _setCrunch(newCrunch);
    }

    /**
     * @dev Internal implementation of the release() method.
     * @dev The methods will fail if there is no tokens due.
     * @dev A `TokensReleased` event will be emitted.
     * @dev If the vesting's released tokens is the same of the vesting's amount, the vesting is considered as finished, and will be removed from the active list.
     * @param beneficiary Address to release.
     */
    function _release(address beneficiary) internal returns (uint256 released) {
        released = _doRelease(beneficiary);
        _checkReleased(released);
    }

    function _doRelease(address beneficiary) internal returns (uint256 unreleased) {
        Vesting storage vesting = _getVesting(beneficiary);

        unreleased = _releasableAmount(vesting);
        if (unreleased != 0) {
            crunch.transfer(vesting.beneficiary, unreleased);

            vesting.released += unreleased;
            totalSupply -= unreleased;

            emit TokensReleased(vesting.beneficiary, unreleased);
        }
    }

    function _checkReleased(uint256 released) internal pure {
        require(released > 0, "MultiVesting: no tokens are due");
    }

    function _clear(address beneficiary) internal {
        Vesting storage vesting = _getVesting(beneficiary);

        require(vesting.revoked, "MultiVesting: vesting not revoked");
        require(vesting.amount == vesting.released, "MultiVesting: still have tokens");

        delete vestings[beneficiary];

        emit VestingCleared(beneficiary);
    }

    /**
     * @dev Compute the releasable amount.
     * @param vesting Vesting instance.
     */
    function _releasableAmount(Vesting memory vesting) internal view returns (uint256) {
        return _vestedAmount(vesting) - vesting.released;
    }

    /**
     * @dev Compute the vested amount.
     * @param vesting Vesting instance.
     */
    function _vestedAmount(Vesting memory vesting) internal view returns (uint256) {
        if (startDate == 0) {
            return 0;
        }

        uint256 cliff = startDate + vesting.cliffDuration;

        if (block.timestamp < cliff) {
            return 0;
        }

        if ((block.timestamp >= startDate + vesting.duration) || vesting.revoked) {
            return vesting.amount;
        }

        return (vesting.amount * (block.timestamp - startDate)) / vesting.duration;
    }

    /**
     * @dev Get a vesting.
     * @param beneficiary Address to get it from.
     * @return vesting struct stored in the storage.
     */
    function _getVesting(address beneficiary) internal view returns (Vesting storage) {
        require(isVested(beneficiary), "MultiVesting: address is not vested");

        return vestings[beneficiary];
    }

    /**
     * @dev Update the CRUNCH token address.
     * @dev A `CrunchTokenUpdated` event will be emitted.
     * @param newCrunch New CRUNCH token address.
     */
    function _setCrunch(address newCrunch) internal {
        require(address(crunch) != newCrunch, "MultiVesting: crunch is the same as before");

        address previousCrunch = address(crunch);

        crunch = IERC20Metadata(newCrunch);

        emit CrunchTokenUpdated(previousCrunch, address(newCrunch));
    }

    modifier onlyWhenNotStarted() {
        require(startDate == 0, "MultiVesting: already started");
        _;
    }
}
