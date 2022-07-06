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
    event TokensReleased(
        address indexed beneficiary,
        uint256 index,
        uint256 amount
    );

    event CrunchTokenUpdated(
        address indexed previousCrunchToken,
        address indexed newCrunchToken
    );

    event CreatorChanged(
        address indexed previousAddress,
        address indexed newAddress
    );

    event VestingCreated(
        address indexed beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 duration,
        uint256 index
    );

    struct Vesting {
        /* beneficiary of tokens after they are released. */
        address beneficiary;
        /** the amount of token to vest. */
        uint256 amount;
        /** the cliff time of the token vesting. */
        uint256 cliffDuration;
        /** the duration of the token vesting. */
        uint256 duration;
        /** the amount of the token released. */
        uint256 released;
        /** this vesting index. */
        uint256 index;
        /** if everything as been released. */
        bool completed;
    }

    /* CRUNCH erc20 address. */
    IERC20Metadata public crunch;

    /** currently locked tokens that are being used by all of the vestings */
    uint256 public totalSupply;

    uint256 public startDate;

    /** mapping to vesting list */
    mapping(address => Vesting[]) public vestings;

    /**
     * @notice Instanciate a new contract.
     * @param _crunch CRUNCH token address.
     */
    constructor(address _crunch) {
        _setCrunch(_crunch);
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
        uint256 duration
    ) external onlyOwner onlyWhenNotStarted {
        require(
            beneficiary != address(0),
            "MultiVesting: beneficiary is the zero address"
        );

        require(amount > 0, "MultiVesting: amount is 0");

        require(duration > 0, "MultiVesting: duration is 0");

        require(
            cliffDuration <= duration,
            "MultiVesting: cliff is longer than duration"
        );

        require(
            availableReserve() >= amount,
            "MultiVesting: available reserve is not enough"
        );

        uint256 index = vestings[beneficiary].length;

        vestings[beneficiary].push(
            Vesting({
                beneficiary: beneficiary,
                amount: amount,
                cliffDuration: cliffDuration,
                duration: duration,
                released: 0,
                index: index,
                completed: false
            })
        );

        totalSupply += amount;

        emit VestingCreated(
            beneficiary,
            amount,
            cliffDuration,
            duration,
            index
        );
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

    /**
     * @notice Release a vesting of the current caller by its `index`.
     * @dev A `TokensReleased` event will be emitted.
     * @dev The transaction will fail if no token are due.
     * @param index The vesting index to release.
     */
    function release(uint256 index) external returns (uint256) {
        return _release(_msgSender(), index);
    }

    /**
     * @notice Release a vesting of a specified address by its `index`.
     * @dev The caller must be the owner.
     * @param beneficiary Address to release.
     * @param index The vesting index to release.
     */
    function releaseFor(address beneficiary, uint256 index)
        external
        onlyOwner
        returns (uint256)
    {
        return _release(beneficiary, index);
    }

    /**
     * @notice Release all of active vesting of the current caller.
     * @dev Multiple `TokensReleased` event might be emitted.
     * @dev The transaction will fail if no token are due.
     */
    function releaseAll() external returns (uint256) {
        return _releaseAll(_msgSender());
    }

    /**
     * @notice Release all of active vesting of a specified address.
     * @dev Multiple `TokensReleased` event might be emitted.
     * @dev The transaction will fail if no token are due.
     */
    function releaseAllFor(address beneficiary)
        external
        onlyOwner
        returns (uint256)
    {
        return _releaseAll(beneficiary);
    }

    /**
     * @notice Get the total of releasable amount of tokens by doing the sum of all of the currently active vestings.
     * @param beneficiary Address to check.
     * @return total The sum of releasable amounts.
     */
    function releasableAmount(address beneficiary)
        public
        view
        returns (uint256 total)
    {
        uint256 size = vestingsCount(beneficiary);

        for (uint256 index = 0; index < size; ++index) {
            Vesting storage vesting = _getVesting(beneficiary, index);

            total += _releasableAmount(vesting);
        }
    }

    /**
     * @notice Get the releasable amount of tokens of a vesting by its `index`.
     * @param beneficiary Address to check.
     * @param index Vesting index to check.
     * @return The releasable amount of tokens of the found vesting.
     */
    function releasableAmountAt(address beneficiary, uint256 index)
        external
        view
        returns (uint256)
    {
        Vesting storage vesting = _getVesting(beneficiary, index);

        return _releasableAmount(vesting);
    }

    /**
     * @notice Get the sum of all vested amount of tokens.
     * @param beneficiary Address to check.
     * @return total The sum of vested amount of all of the vestings.
     */
    function vestedAmount(address beneficiary)
        public
        view
        returns (uint256 total)
    {
        uint256 size = vestingsCount(beneficiary);

        for (uint256 index = 0; index < size; ++index) {
            Vesting storage vesting = _getVesting(beneficiary, index);

            total += _vestedAmount(vesting);
        }
    }

    /**
     * @notice Get the vested amount of tokens of a vesting by its `index`.
     * @param beneficiary Address to check.
     * @param index Address to check.
     * @return The vested amount of the found vesting.
     */
    function vestedAmountAt(address beneficiary, uint256 index)
        external
        view
        returns (uint256)
    {
        Vesting storage vesting = _getVesting(beneficiary, index);

        return _vestedAmount(vesting);
    }

    /**
     * @notice Get the sum of all remaining amount of tokens of each vesting of a beneficiary.
     * @dev This function is to make wallets able to display the amount in their UI.
     * @param beneficiary Address to check.
     * @return total The sum of all remaining amount of tokens.
     */
    function balanceOf(address beneficiary)
        external
        view
        returns (uint256 total)
    {
        uint256 size = vestingsCount(beneficiary);

        for (uint256 index = 0; index < size; ++index) {
            Vesting storage vesting = _getVesting(beneficiary, index);

            total += vesting.amount - vesting.released;
        }
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
     * @notice Get the number of vesting of an address.
     * @param beneficiary Address to check.
     * @return Number of vesting.
     */
    function vestingsCount(address beneficiary) public view returns (uint256) {
        return vestings[beneficiary].length;
    }

    /**
     * @dev Internal implementation of the release() method.
     * @dev The methods will fail if there is no tokens due.
     * @dev A `TokensReleased` event will be emitted.
     * @dev If the vesting's released tokens is the same of the vesting's amount, the vesting is considered as finished, and will be removed from the active list.
     * @param beneficiary Address to release.
     * @param index Vesting index to release.
     */
    function _release(address beneficiary, uint256 index)
        internal
        returns (uint256 released)
    {
        released = _doRelease(beneficiary, index);
        _checkReleased(released);
    }

    /**
     * @dev Internal implementation of the releaseAll() method.
     * @dev The methods will fail if there is no tokens due for all of the vestings.
     * @dev Multiple `TokensReleased` event may be emitted.
     * @dev If some vesting's released tokens is the same of their amount, they will considered as finished, and will be marked as completed.
     * @param beneficiary Address to release.
     */
    function _releaseAll(address beneficiary)
        internal
        returns (uint256 released)
    {
        uint256 size = vestingsCount(beneficiary);

        for (uint256 index = 0; index < size; ++index) {
            released += _doRelease(beneficiary, index);
        }

        _checkReleased(released);
    }

    function _doRelease(address beneficiary, uint256 index) internal returns (uint256) {
        Vesting storage vesting = _getVesting(beneficiary, index);

        if (vesting.completed) {
            return 0;
        }

        uint256 unreleased = _releasableAmount(vesting);
        if (unreleased != 0) {
            crunch.transfer(vesting.beneficiary, unreleased);

            vesting.released += unreleased;
            totalSupply -= unreleased;

            emit TokensReleased(vesting.beneficiary, vesting.index, unreleased);

            if (vesting.released == vesting.amount) {
                vesting.completed = true;
            }
        }

        return unreleased;
    }

    function _checkReleased(uint256 released) internal pure {
        require(released > 0, "MultiVesting: no tokens are due");
    }

    /**
     * @dev Compute the releasable amount.
     * @param vesting Vesting instance.
     */
    function _releasableAmount(Vesting memory vesting)
        internal
        view
        returns (uint256)
    {
        return _vestedAmount(vesting) - vesting.released;
    }

    /**
     * @dev Compute the vested amount.
     * @param vesting Vesting instance.
     */
    function _vestedAmount(Vesting memory vesting)
        internal
        view
        returns (uint256)
    {
        if (startDate == 0) {
            return 0;
        }

        uint256 cliff = startDate + vesting.cliffDuration;

        if (block.timestamp < cliff) {
            return 0;
        }

        if ((block.timestamp >= startDate + vesting.duration)) {
            return vesting.amount;
        }

        // TODO: Rename for something better?
        uint256 since = block.timestamp - startDate;
        return (vesting.amount * since) / vesting.duration;
    }

    /**
     * @dev Get a vesting.
     * @param beneficiary Address to get it from.
     * @param index Index to get it from.
     * @return A vesting struct stored in the storage.
     */
    function _getVesting(address beneficiary, uint256 index)
        internal
        view
        returns (Vesting storage)
    {
        return vestings[beneficiary][index];
    }

    /**
     * @dev Update the CRUNCH token address.
     * @dev A `CrunchTokenUpdated` event will be emitted.
     * @param newCrunch New CRUNCH token address.
     */
    function _setCrunch(address newCrunch) internal {
        address previousCrunch = address(crunch);

        crunch = IERC20Metadata(newCrunch);

        emit CrunchTokenUpdated(previousCrunch, address(newCrunch));
    }

    modifier onlyWhenNotStarted() {
        require(startDate == 0, "MultiVesting: already started");
        _;
    }
}
