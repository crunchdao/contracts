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
    event YieldUpdated(uint256 yield, uint256 totalDebt);

    struct Holder {
        uint256 index;
        uint256 totalStaked;
        uint256 rewardDebt;
        Stake[] stakes;
    }

    struct Stake {
        uint256 amount;
        uint256 start;
    }

    uint256 public yield;
    address[] public addresses;
    mapping(address => Holder) public holders;
    uint256 public totalStaked;

    /** @dev Initializes the contract by specifying the parent `crunch` and the initial `yield`. */
    constructor(CrunchToken crunch, uint256 _yield) HasCrunchParent(crunch) {
        yield = _yield;
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

    function isStaking() public view returns (bool) {
        return isStaking(_msgSender());
    }

    function isStaking(address addr) public view returns (bool) {
        return _isStaking(holders[addr]);
    }

    /** @dev Returns the contract CRUNCH balance. */
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

    /** @dev Returns the computed reward of the specified `addr`. */
    function totalRewardOf(address addr) public view returns (uint256) {
        Holder storage holder = holders[addr];

        return _computeRewardOf(holder);
    }

    function isReserveSufficient() public view returns (bool) {
        return _isReserveSufficient(totalReward());
    }

    function isReserveSufficientFor(address addr) public view returns (bool) {
        return _isReserveSufficient(totalRewardOf(addr));
    }

    /** @dev Returns the number of address current staking. */
    function stakerCount() public view returns (uint256) {
        return addresses.length;
    }

    /**
     * @dev Force an emergency withdraw.
     *
     * This must only be called in case of an emergency.
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
     * @dev Update the yield.
     *
     * This will recompute a reward debt with the previous yield value.
     * The debt is used to make sure that everyone will kept their rewarded token with the previous yield value.
     *
     * Emits a {YieldUpdated} event.
     *
     * Requirements:
     *
     * - `to` must not be the same as the yield.
     * - `to` must be below or equal to 3000.
     */
    function setYield(uint256 to) public onlyOwner {
        require(yield != to, "Staking: yield value must be different");
        require(to <= 3000, "Staking: yield must be below 3000/1M token/day");

        uint256 debt = _updateDebts();
        yield = to;

        emit YieldUpdated(yield, debt);
    }

    /**
     * @dev Destroy the contact after withdrawing everyone.
     *
     * If the reserve is not zero after the withdraw, the remaining will be sent back to the contract's owner.
     */
    function destroy() public onlyOwner {
        uint256 usable = reserve();

        uint256 length = addresses.length;
        for (uint256 index = 0; index < length; index++) {
            address addr = addresses[index];
            Holder storage holder = holders[addr];

            uint256 reward = _computeRewardOf(holder);

            require(usable >= reward, "Staking: reserve does not have enough");

            uint256 total = holder.totalStaked + reward;
            crunch.transfer(addr, total);
        }

        _transferRemainingAndSelfDestruct();
    }

    /**
     * @dev Destroy the contact after withdrawing everyone.
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

        uint256 reward = _computeRewardOf(holder);

        require(
            _isReserveSufficient(reward),
            "Staking: the reserve does not have enough token"
        );

        uint256 staked = holder.totalStaked;
        uint256 total = staked + reward;
        crunch.transfer(addr, total);

        totalStaked -= staked;

        delete holders[addr];
        _deleteAddress(holder.index);

        emit Withdrawed(addr, reward, staked, total);
    }

    function _emergencyWithdraw(address addr) internal {
        Holder storage holder = holders[addr];

        require(_isStaking(holder), "Staking: no stakes");

        uint256 staked = holder.totalStaked;
        crunch.transfer(addr, staked);

        totalStaked -= staked;

        delete holders[addr];
        _deleteAddress(holder.index);

        emit EmergencyWithdrawed(addr, staked);
    }

    function _isReserveSufficient(uint256 reward) private view returns (bool) {
        return reserve() >= reward;
    }

    function _isStaking(Holder storage holder) internal view returns (bool) {
        return holder.stakes.length != 0;
    }

    function _updateDebts() internal returns (uint256 total) {
        uint256 length = addresses.length;
        for (uint256 index = 0; index < length; index++) {
            address addr = addresses[index];
            Holder storage holder = holders[addr];

            uint256 debt = _computeRewardOf(holder);

            holder.rewardDebt += debt;

            total += debt;
        }
    }

    function _computeTotalReward() internal view returns (uint256 total) {
        uint256 length = addresses.length;
        for (uint256 index = 0; index < length; index++) {
            address addr = addresses[index];
            Holder storage holder = holders[addr];

            total += _computeRewardOf(holder);
        }
    }

    function _computeRewardOf(Holder storage holder)
        internal
        view
        returns (uint256 total)
    {
        uint256 length = holder.stakes.length;
        for (uint256 index = 0; index < length; index++) {
            Stake storage stake = holder.stakes[index];

            total += _computeStakeReward(stake);
        }
    }

    function _computeStakeReward(Stake storage stake)
        internal
        view
        returns (uint256)
    {
        uint256 numberOfDays = ((block.timestamp - stake.start) / 1 days);

        return (stake.amount * numberOfDays * yield) / 1_000_000;
    }

    function _deleteAddress(uint256 index) internal {
        delete addresses[index];

        uint256 length = addresses.length;
        if (length != 0) {
            address addr = addresses[length - 1];
            holders[addr].index = index;

            addresses.pop();
        }
    }

    function _transferRemainingAndSelfDestruct() internal {
        uint256 remaining = contractBalance();
        if (remaining != 0) {
            crunch.transfer(owner(), remaining);
        }

        selfdestruct(payable(owner()));
    }
}
