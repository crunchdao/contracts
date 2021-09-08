// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./erc677/IERC677Receiver.sol";
import "./access/HasCrunchParent.sol";
import "./CrunchToken.sol";

contract CrunchStaking is HasCrunchParent, IERC677Receiver {
    event Withdrawed(
        address indexed to,
        uint256 reward,
        uint256 staked,
        uint256 totalAmount
    );

    event EmergencyWithdrawed(address indexed to, uint256 staked);
    event Deposited(address indexed sender, uint256 amount);
    event RewardPerDayUpdated(uint256 rewardPerDay, uint256 totalDebt);

    struct Holder {
        /** Index in `addresses`, used for faster lookup in case of a remove. */
        uint256 index;
        /** Total amount staked by the holder. */
        uint256 totalStaked;
        /** When the reward per day is updated, the reward debt is updated to ensure that the previous reward they could have got isn't lost. */
        uint256 rewardDebt;
        /** Individual stakes. */
        Stake[] stakes;
    }

    struct Stake {
        /** How much the stake is. */
        uint256 amount;
        /** When does the stakes 'start' is. When created it is `block.timestamp`, and is updated when the `reward per day` is updated. */
        uint256 start;
    }

    /** The `reward per day` is the amount of tokens rewarded for 1 million CRUNCHs staked over a 1 day period. */
    uint256 public rewardPerDay;

    /** List of all currently staking addresses. Used for looping. */
    address[] public addresses;

    /** address to Holder mapping. */
    mapping(address => Holder) public holders;

    /** Currently total staked amount by everyone. It is incremented when someone deposit token, and decremented when someone withdraw. This value does not include the rewards. */
    uint256 public totalStaked;

    /** @dev Initializes the contract by specifying the parent `crunch` and the initial `rewardPerDay`. */
    constructor(CrunchToken crunch, uint256 _rewardPerDay) HasCrunchParent(crunch) {
        rewardPerDay = _rewardPerDay;
    }

    /**
     * @dev Deposit an `amount` of tokens from your account to this contract.
     *
     * This will start the staking with the provided amount.
     * The implementation call {IERC20-transferFrom}, so the caller must have previously {IERC20-approve} the `amount`.
     *
     * Emits a {Deposited} event.
     *
     * Requirements:
     *
     * - `amount` cannot be the zero address.
     * - `caller` must have a balance of at least `amount`.
     */
    function deposit(uint256 amount) public {
        crunch.transferFrom(_msgSender(), address(this), amount);

        _deposit(_msgSender(), amount);
    }

    /**
     * @dev Withdraw the staked tokens with the reward.
     *
     * Emits a {Withdrawed} event.
     *
     * Requirements:
     *
     * - `caller` to be staking.
     */
    function withdraw() public {
        _withdraw(_msgSender());
    }

    /** @dev Returns the current reserve for rewards. */
    function reserve() public view returns (uint256) {
        uint256 balance = contractBalance();

        if (totalStaked > balance) {
            revert(
                "Staking: the balance has less CRUNCH than the total staked"
            );
        }

        return balance - totalStaked;
    }

    /**
     * @dev Test if the caller is currently staking.
     * @return `true` if the caller is staking, else if not.
     */
    function isStaking() public view returns (bool) {
        return isStaking(_msgSender());
    }

    /**
     * @dev Test if an address is currently staking.
     * @param `addr` address to test.
     * @return `true` if the address is staking, else if not.
     */
    function isStaking(address addr) public view returns (bool) {
        return _isStaking(holders[addr]);
    }

    /**
     * @dev Get the current balance (`crunch.balanceOf(address)`) in CRUNCH of this smart contract.
     * @return The current staking contract's balance in CRUNCH.
     */
    function contractBalance() public view returns (uint256) {
        return crunch.balanceOf(address(this));
    }

    /** @dev Returns the sum of the specified `addr` staked amount. */
    function totalStakedOf(address addr) public view returns (uint256) {
        return holders[addr].totalStaked;
    }

    /** @dev Returns the computed reward of everyone. */
    function totalReward() public view returns (uint256 total) {
        uint256 length = addresses.length;
        for (uint256 index = 0; index < length; index++) {
            address addr = addresses[index];

            total += totalRewardOf(addr);
        }
    }

    /**
     * Compute the reward of the specified `addr`
     *
     * @param addr address to test.
     * @return the reward the address would get.
     */
    function totalRewardOf(address addr) public view returns (uint256) {
        Holder storage holder = holders[addr];

        return
            _computeRewardOf(
                holder,
                true /* include debt */
            );
    }

    /**
     * Test if the reserve is sufficient to cover the `{totalReward()}`.
     *
     * @return whether the reserve has enough CRUNCH to give to everyone.
     */
    function isReserveSufficient() public view returns (bool) {
        return _isReserveSufficient(totalReward());
    }

    /**
     * Test if the reserve is sufficient to cover the `{totalRewardOf(address)}` of the specified address.
     *
     * @param addr address to test.
     * @return whether the reserve has enough CRUNCH to give to this address.
     */
    function isReserveSufficientFor(address addr) public view returns (bool) {
        return _isReserveSufficient(totalRewardOf(addr));
    }

    /**
     * Get the number of address current staking.
     *
     * @return the length of the `addresses` array.
     */
    function stakerCount() public view returns (uint256) {
        return addresses.length;
    }

    function stakesOf(address addr) public view returns (Stake[] memory) {
        return holders[addr].stakes;
    }

    /**
     * @dev ONLY FOR EMERGENCY!!
     *
     * Emergency withdraw.
     *
     * All rewards are discarded. Only initial staked amount will be transfered back!
     *
     * Emits a {EmergencyWithdrawed} event.
     *
     * Requirements:
     *
     * - `caller` to be staking.
     */
    function emergencyWithdraw() public {
        _emergencyWithdraw(_msgSender());
    }

    /**
     * Update the reward per day.
     *
     * This will recompute a reward debt with the previous reward per day value.
     * The debt is used to make sure that everyone will keep their rewarded tokens using the previous reward per day value for the calculation.
     *
     * Emits a {RewardPerDayUpdated} event.
     *
     * Requirements:
     *
     * - `to` must not be the same as the reward per day.
     * - `to` must be below or equal to 3000.
     *
     * @param to new reward per day value.
     */
    function setRewardPerDay(uint256 to) public onlyOwner {
        require(rewardPerDay != to, "Staking: reward per day value must be different");
        require(to <= 3000, "Staking: reward per day must be below 3000/1M token/day");

        uint256 debt = _updateDebts();
        rewardPerDay = to;

        emit RewardPerDayUpdated(rewardPerDay, debt);
    }

    /**
     * Destroy the contact after withdrawing everyone.
     *
     * @dev If the reserve is not zero after the withdraw, the remaining will be sent back to the contract's owner.
     */
    function destroy() public onlyOwner {
        uint256 usable = reserve();

        uint256 length = addresses.length;
        for (uint256 index = 0; index < length; index++) {
            address addr = addresses[index];
            Holder storage holder = holders[addr];

            uint256 reward = _computeRewardOf(
                holder,
                true /* include debt */
            );

            require(usable >= reward, "Staking: reserve does not have enough");

            uint256 total = holder.totalStaked + reward;
            crunch.transfer(addr, total);
        }

        _transferRemainingAndSelfDestruct();
    }

    /**
     * @dev ONLY FOR EMERGENCY!!
     *
     * Destroy the contact after emergency withdrawing everyone, avoiding the reward computation to save gas.
     *
     * If the reserve is not zero after the withdraw, the remaining will be sent back to the contract's owner.
     */
    function emergencyDestroy() public onlyOwner {
        uint256 length = addresses.length;
        for (uint256 index = 0; index < length; index++) {
            address addr = addresses[index];
            Holder storage holder = holders[addr];

            crunch.transfer(addr, holder.totalStaked);
        }

        _transferRemainingAndSelfDestruct();
    }

    /** @dev Internal function called when the {IERC677-transferAndCall} is used. */
    function onTokenTransfer(
        address sender,
        uint256 value,
        bytes memory data
    ) external override onlyCrunchParent {
        data; /* silence unused */

        _deposit(sender, value);
    }

    function _deposit(address from, uint256 amount) internal {
        require(amount != 0, "cannot deposit zero");

        Holder storage holder = holders[from];

        if (!_isStaking(holder)) {
            holder.index = addresses.length;
            addresses.push(from);
        }

        holder.totalStaked += amount;
        holder.stakes.push(Stake({amount: amount, start: block.timestamp}));

        totalStaked += amount;

        emit Deposited(from, amount);
    }

    function _withdraw(address addr) internal {
        Holder storage holder = holders[addr];

        require(_isStaking(holder), "Staking: no stakes");

        uint256 reward = _computeRewardOf(
            holder,
            true /* include debt */
        );

        require(
            _isReserveSufficient(reward),
            "Staking: the reserve does not have enough token"
        );

        uint256 staked = holder.totalStaked;
        uint256 total = staked + reward;
        crunch.transfer(addr, total);

        totalStaked -= staked;

        _deleteAddress(holder.index);
        delete holders[addr];

        emit Withdrawed(addr, reward, staked, total);
    }

    function _emergencyWithdraw(address addr) internal {
        Holder storage holder = holders[addr];

        require(_isStaking(holder), "Staking: no stakes");

        uint256 staked = holder.totalStaked;
        crunch.transfer(addr, staked);

        totalStaked -= staked;

        _deleteAddress(holder.index);
        delete holders[addr];

        emit EmergencyWithdrawed(addr, staked);
    }

    /**
     * Test if the `reserve` is sufficiant for a specified reward.
     *
     * @param reward value to test.
     * @return if the reserve is bigger or equal to the `reward` parameter.
     */
    function _isReserveSufficient(uint256 reward) private view returns (bool) {
        return reserve() >= reward;
    }

    /**
     * Test if an holder struct is currently staking.
     *
     * @dev Its done by testing if the stake array length is equal to zero. Since its not possible, it mean that the holder is not currently staking and the struct is only zero.
     *
     * @return `true` if the holder is staking, `false` otherwise.
     */
    function _isStaking(Holder storage holder) internal view returns (bool) {
        return holder.stakes.length != 0;
    }

    /**
     * Update the reward debt of all holders.
     *
     * @dev Usually called before a `reward per day` update.
     *
     * @return total total debt updated.
     */
    function _updateDebts() internal returns (uint256 total) {
        uint256 length = addresses.length;
        for (uint256 index = 0; index < length; index++) {
            address addr = addresses[index];
            Holder storage holder = holders[addr];

            uint256 debt = _computeRewardOf(
                holder,
                false /* do not include debt */
            );

            holder.rewardDebt += debt;

            total += debt;
        }
    }

    /**
     * Compute the reward for every holder.
     *
     * @return total the total of all of the reward for all of the holders.
     */
    function _computeTotalReward() internal view returns (uint256 total) {
        uint256 length = addresses.length;
        for (uint256 index = 0; index < length; index++) {
            address addr = addresses[index];
            Holder storage holder = holders[addr];

            total += _computeRewardOf(
                holder,
                true /* include debt */
            );
        }
    }

    /**
     * Compute all of stakes reward for an holder.
     *
     * @param holder the holder struct.
     * @param includeDebt if the debt should be included in the total.
     * @return total total reward for the holder.
     */
    function _computeRewardOf(Holder storage holder, bool includeDebt)
        internal
        view
        returns (uint256 total)
    {
        uint256 length = holder.stakes.length;
        for (uint256 index = 0; index < length; index++) {
            Stake storage stake = holder.stakes[index];

            total += _computeStakeReward(stake);
        }

        if (includeDebt) {
            total += holder.rewardDebt;
        }
    }

    /**
     * Compute the reward of a single stake.
     *
     * @param stake the stake struct.
     * @return the token rewarded (does not include the debt).
     */
    function _computeStakeReward(Stake storage stake)
        internal
        view
        returns (uint256)
    {
        uint256 numberOfDays = ((block.timestamp - stake.start) / 1 days);

        return (stake.amount * numberOfDays * rewardPerDay) / 1_000_000;
    }

    /**
     * Delete an address from the `addresses` array.
     *
     * @dev To avoid holes, the last value will replace the deleted address.
     */
    function _deleteAddress(uint256 index) internal {
        uint256 length = addresses.length;
        require(
            length != 0,
            "Staking: cannot remove address if array length is zero"
        );

        uint256 last = length - 1;
        if (last != index) {
            address addr = addresses[last];
            addresses[index] = addr;
            holders[addr].index = index;
        }

        addresses.pop();
    }

    /**
     * Transfer the remaining tokens back to the current contract owner and then self destruct.
     *
     * @dev This function must only be called for destruction!!
     * @dev If the balance is 0, the `CrunchToken#transfer(address, uint256)` is not called.
     */
    function _transferRemainingAndSelfDestruct() internal {
        uint256 remaining = contractBalance();
        if (remaining != 0) {
            crunch.transfer(owner(), remaining);
        }

        selfdestruct(payable(owner()));
    }
}
