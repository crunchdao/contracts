// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./access/HasERC677TokenParent.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Crunch Multi Vesting V2
 * @author Enzo CACERES <enzo.caceres@crunchdao.com>
 * @notice Allow the vesting of multiple users using only one contract.
 */
contract CrunchMultiVestingV2 is HasERC677TokenParent {
    using Counters for Counters.Counter;

    // prettier-ignore
    event VestingBegin(
        uint256 startDate
    );

    // prettier-ignore
    event TokensReleased(
        uint256 indexed vestingId,
        address indexed beneficiary,
        uint256 amount
    );

    // prettier-ignore
    event VestingCreated(
        uint256 indexed vestingId,
        address indexed beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 duration,
        bool revocable
    );

    // prettier-ignore
    event VestingRevoked(
        uint256 indexed vestingId,
        address indexed beneficiary,
        uint256 refund
    );

    // prettier-ignore
    event VestingTransfered(
        uint256 indexed vestingId,
        address indexed from,
        address indexed to
    );

    struct Vesting {
        /** vesting id. */
        uint256 id;
        /** address that will receive the token. */
        address beneficiary;
        /** the amount of token to vest. */
        uint256 amount;
        /** the cliff time of the token vesting. */
        uint256 cliffDuration;
        /** the duration of the token vesting. */
        uint256 duration;
        /** whether the vesting can be revoked. */
        bool revocable;
        /** whether the vesting is revoked. */
        bool revoked;
        /** the amount of the token released. */
        uint256 released;
    }

    /** currently locked tokens that are being used by all of the vestings */
    uint256 public totalSupply;

    uint256 public startDate;

    /** mapping to vesting list */
    mapping(uint256 => Vesting) public vestings;

    /** mapping to list of address's owning vesting id */
    mapping(address => uint256[]) public owned;

    Counters.Counter private _idCounter;

    /**
     * @notice Instanciate a new contract.
     * @param crunch CRUNCH token address.
     */
    constructor(address crunch) HasERC677TokenParent(crunch) {}

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
        return parentToken.decimals();
    }

    /**
     * @notice Get the current reserve (or balance) of the contract in CRUNCH.
     * @return The balance of CRUNCH this contract has.
     */
    function reserve() public view returns (uint256) {
        return parentToken.balanceOf(address(this));
    }

    /**
     * @notice Get the available reserve.
     * @return The number of CRUNCH that can be used to create another vesting.
     */
    function availableReserve() public view returns (uint256) {
        return reserve() - totalSupply;
    }

    /**
     * @notice Begin the vesting of everyone at the current block timestamp.
     */
    function beginNow() external onlyOwner {
        _begin(block.timestamp);
    }

    /**
     * @notice Begin the vesting of everyone at a specified timestamp.
     * @param timestamp Timestamp to use as a begin date.
     */
    function beginAt(uint256 timestamp) external onlyOwner {
        require(timestamp != 0, "MultiVesting: timestamp cannot be zero");

        _begin(timestamp);
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
    function vest(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 duration,
        bool revocable
    ) external onlyOwner onlyWhenNotStarted {
        require(beneficiary != address(0), "MultiVesting: beneficiary is the zero address");
        require(amount > 0, "MultiVesting: amount is 0");
        require(duration > 0, "MultiVesting: duration is 0");
        require(cliffDuration <= duration, "MultiVesting: cliff is longer than duration");
        require(availableReserve() >= amount, "MultiVesting: available reserve is not enough");

        uint256 vestingId = _nextId();

        // prettier-ignore
        vestings[vestingId] = Vesting({
            id: vestingId,
            beneficiary: beneficiary,
            amount: amount,
            cliffDuration: cliffDuration,
            duration: duration,
            revocable: revocable,
            revoked: false,
            released: 0
        });

        _addOwnership(beneficiary, vestingId);

        totalSupply += amount;

        emit VestingCreated(vestingId, beneficiary, amount, cliffDuration, duration, revocable);
    }

    function transfer(address to, uint256 vestingId) external {
        _transfer(_getVesting(vestingId, _msgSender()), to);
    }

    function release(uint256 vestingId) external returns (uint256) {
        return _release(_getVesting(vestingId, _msgSender()));
    }

    function releaseAll() external returns (uint256) {
        return _releaseAll(_msgSender());
    }

    function releaseFor(uint256 vestingId) external onlyOwner returns (uint256) {
        return _release(_getVesting(vestingId));
    }

    function releaseAllFor(address beneficiary) external onlyOwner returns (uint256) {
        return _releaseAll(beneficiary);
    }

    function revoke(uint256 vestingId) public onlyOwner returns (uint256) {
        return _revoke(_getVesting(vestingId));
    }

    function isBeneficiary(uint256 vestingId, address account) public view returns (bool) {
        return _isBeneficiary(_getVesting(vestingId), account);
    }

    function isVested(address beneficiary) public view returns (bool) {
        return ownedCount(beneficiary) != 0;
    }

    /**
     * @notice Get the releasable amount of tokens.
     * @param vestingId Vesting ID to check.
     * @return The releasable amounts.
     */
    function releasableAmount(uint256 vestingId) public view returns (uint256) {
        return _releasableAmount(_getVesting(vestingId));
    }

    /**
     * @notice Get the vested amount of tokens.
     * @param vestingId Vesting ID to check.
     * @return The vested amount of the vestings.
     */
    function vestedAmount(uint256 vestingId) public view returns (uint256) {
        return _vestedAmount(_getVesting(vestingId));
    }

    function ownedCount(address beneficiary) public view returns (uint256) {
        return owned[beneficiary].length;
    }

    /**
     * @notice Get the remaining amount of token of a beneficiary.
     * @dev This function is to make wallets able to display the amount in their UI.
     * @param beneficiary Address to check.
     * @return balance The remaining amount of tokens.
     */
    function balanceOf(address beneficiary) external view returns (uint256 balance) {
        uint256[] storage indexes = owned[beneficiary];

        for (uint256 index = 0; index < indexes.length; ++index) {
            uint256 vestingId = indexes[index];

            balance += balanceOf(vestingId);
        }
    }

    function balanceOf(uint256 vestingId) public view returns (uint256) {
        Vesting storage vesting = _getVesting(vestingId);

        return vesting.amount - vesting.released;
    }

    function _begin(uint256 timestamp) internal onlyWhenNotStarted {
        startDate = timestamp;

        emit VestingBegin(startDate);
    }

    function _transfer(Vesting storage vesting, address to) internal {
        address from = vesting.beneficiary;

        require(from != to, "MultiVesting: cannot transfer to itself");
        require(to != address(0), "MultiVesting: target is the zero address");

        _removeOwnership(from, vesting.id);
        _addOwnership(to, vesting.id);

        vesting.beneficiary = to;

        emit VestingTransfered(vesting.id, from, to);
    }

    /**
     * @dev Internal implementation of the release() method.
     * @dev The methods will fail if there is no tokens due.
     * @dev A `TokensReleased` event will be emitted.
     * @dev If the vesting's released tokens is the same of the vesting's amount, the vesting is considered as finished, and will be removed from the active list.
     * @param vesting Vesting to release.
     */
    function _release(Vesting storage vesting) internal returns (uint256 unreleased) {
        unreleased = _doRelease(vesting);
        _checkAmount(unreleased);
    }

    function _releaseAll(address beneficiary) internal returns (uint256 unreleased) {
        uint256[] storage indexes = owned[beneficiary];

        for (uint256 index = 0; index < indexes.length; ++index) {
            uint256 vestingId = indexes[index];
            Vesting storage vesting = vestings[vestingId];

            unreleased += _doRelease(vesting);
        }

        _checkAmount(unreleased);
    }

    function _doRelease(Vesting storage vesting) internal returns (uint256 unreleased) {
        unreleased = _releasableAmount(vesting);

        if (unreleased != 0) {
            parentToken.transfer(vesting.beneficiary, unreleased);

            vesting.released += unreleased;
            totalSupply -= unreleased;

            emit TokensReleased(vesting.id, vesting.beneficiary, unreleased);
        }
    }

    function _checkAmount(uint256 unreleased) internal pure {
        require(unreleased > 0, "MultiVesting: no tokens are due");
    }

    function _revoke(Vesting storage vesting) internal returns (uint256 refund) {
        require(vesting.revocable, "MultiVesting: token not revocable");
        require(!vesting.revoked, "MultiVesting: token already revoked");

        uint256 unreleased = _releasableAmount(vesting);
        refund = vesting.amount - unreleased;

        vesting.revoked = true;

        parentToken.transfer(owner(), refund);
        vesting.amount -= refund;

        emit VestingRevoked(vesting.id, vesting.beneficiary, refund);
    }

    function _isBeneficiary(Vesting storage vesting, address account) internal view returns (bool) {
        return vesting.beneficiary == account;
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

        uint256 cliffEnd = startDate + vesting.cliffDuration;

        if (block.timestamp < cliffEnd) {
            return 0;
        }

        if ((block.timestamp >= cliffEnd + vesting.duration) || vesting.revoked) {
            return vesting.amount;
        }

        return (vesting.amount * (block.timestamp - cliffEnd)) / vesting.duration;
    }

    /**
     * @dev Get a vesting.
     * @return vesting struct stored in the storage.
     */
    function _getVesting(uint256 vestingId) internal view returns (Vesting storage vesting) {
        vesting = vestings[vestingId];
        require(vesting.beneficiary != address(0), "MultiVesting: vesting does not exists");
    }

    /**
     * @dev Get a vesting and make sure it is from the right beneficiary.
     * @param beneficiary Address to get it from.
     * @return vesting struct stored in the storage.
     */
    function _getVesting(uint256 vestingId, address beneficiary) internal view returns (Vesting storage vesting) {
        vesting = _getVesting(vestingId);
        require(vesting.beneficiary == beneficiary, "MultiVesting: not the beneficiary");
    }

    function _nextId() internal returns (uint256 id) {
        id = _idCounter.current();
        _idCounter.increment();
    }

    function _indexOf(uint256[] storage array, uint256 value) internal view returns (bool, uint256) {
        for (uint256 index = 0; index < array.length; ++index) {
            if (array[index] == value) {
                return (true, index);
            }
        }

        return (false, 0);
    }

    function _removeOwnership(address account, uint256 vestingId) internal returns (bool) {
        uint256[] storage indexes = owned[account];

        (bool found, uint256 index) = _indexOf(indexes, vestingId);
        if (!found) {
            return false;
        }

        if (indexes.length <= 1) {
            delete owned[account];
        } else {
            indexes[index] = indexes[indexes.length - 1];
            indexes.pop();
        }

        return true;
    }

    function _addOwnership(address account, uint256 vestingId) internal {
        owned[account].push(vestingId);
    }

    modifier onlyWhenNotStarted() {
        require(startDate == 0, "MultiVesting: already started");
        _;
    }
}
