// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./Stakeholding.sol";
import "./erc677/IERC677Receiver.sol";
import "./access/HasCrunchParent.sol";
import "./CrunchToken.sol";

contract CrunchStaking is HasCrunchParent, IERC677Receiver {
    using Stakeholding for Stakeholding.Stakeholder[];
    using Stakeholding for Stakeholding.Stakeholder;
    using Stakeholding for Stakeholding.Stake;

    event YieldUpdated(uint256 yield, uint256 totalDebt);

    event Withdrawed(
        address indexed to,
        uint256 reward,
        uint256 staked,
        uint256 totalAmount
    );

    event EmergencyWithdrawed(address indexed to, uint256 staked);
    
    event Deposited(address indexed sender, uint256 amount);

    /**
     * The `yield` is the amount of tokens rewarded for 1 million CRUNCHs staked over a 1 day period.
     *
     * e.g.:
     *  to find the yield for an APR of 24%:
     *    0,24 * 1.000.000 = 240.000    <- tokens rewarded per year
     *    240.000 / 365,25 ~= 657       <- tokens rewarded per day
     *    --> the yield should be 657 for a 24% APR.
     */
    uint256 public yield;
    Stakeholding.Stakeholder[] public stakeholders;

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
        require(amount != 0, "cannot deposit zero");

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

    /**
     * @dev Force a withdraw for a speficied address.
     *
     * Emits a {Withdrawed} event.
     *
     * Requirements:
     *
     * - `addr` to be staking.
     */
    function forceWithdraw(address addr) public onlyOwner {
        _withdraw(addr);
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
     * @dev Force an emergency withdraw for a speficied address.
     *
     * This must only be called in case of an emergency.
     * All rewards are discarded. Only initial staked amount will be transfered back!
     *
     * Emits a {EmergencyWithdrawed} event.
     *
     * Requirements:
     *
     * - `addr` to be staking.
     */
    function forceEmergencyWithdraw(address addr) public onlyOwner {
        _emergencyWithdraw(addr);
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
        require(
            to <= 3000,
            "Staking: yield must be below 3000/1M Token/day"
        );

        uint256 debt = stakeholders.updateDebts(yield);
        yield = to;

        emit YieldUpdated(yield, debt);
    }

    /**
     * @dev Destroy the contact after withdrawing everyone.
     *
     * If the reserve is not zero after the withdraw, the remaining will be sent back to the contract's owner.
     */
    function destroy() public onlyOwner {
        while (stakeholders.length != 0) {
            _withdraw(stakeholders[0], 0);
        }

        _transferRemainingAndSelfDestruct();
    }

    /**
     * @dev Destroy the contact after emergency withdrawing everyone.
     *
     * This is only in case of an emergency.
     * Only staked token will be transfered back.
     *
     * If the reserve is not zero after the withdraw, the remaining will be sent back to the contract's owner.
     */
    function emergencyDestroy() public onlyOwner {
        while (stakeholders.length != 0) {
            _emergencyWithdraw(stakeholders[0], 0);
        }

        _transferRemainingAndSelfDestruct();
    }

    // TODO: This need to be discussed further as this can break trust between owner and stakers.
    // function criticalDestroy() public onlyOwner {
    //     _transferRemainingAndSelfDestruct();
    // }

    /** @dev Returns the sum of everyone staked amount. */
    function totalStaked() public view returns (uint256) {
        return stakeholders.computeTotalStaked();
    }

    /** @dev Returns the sum of the specified `addr` staked amount. */
    function totalStakedOf(address addr) public view returns (uint256) {
        return stakeholders.get(addr).totalStaked;
    }

    /** @dev Returns the computed reward of everyone. */
    function totalReward() public view returns (uint256) {
        return stakeholders.computeReward(yield);
    }

    /** @dev Returns the computed reward of the specified `addr`. */
    function totalRewardOf(address addr) public view returns (uint256) {
        return stakeholders.get(addr).computeReward(yield);
    }

    /** @dev Returns the number of address current staking. */
    function stakerCount() public view returns (uint) {
        return stakeholders.length;
    }

    /** @dev Returns whether a speficied `addr` is currently staking. */
    function isStaking(address addr) public view returns (bool) {
        (bool found, ) = stakeholders.find(addr);

        return found;
    }

    function onTokenTransfer(
        address sender,
        uint256 value,
        bytes memory data
    ) external override onlyCrunchParent {
        data; /* silence unused */

        _deposit(sender, value);
    }

    function _deposit(address from, uint256 amount) private {
        Stakeholding.Stakeholder storage stakeholder = stakeholders.add(from);

        stakeholder.createStake(amount);
    }

    function _withdraw(address addr) internal {
        (
            Stakeholding.Stakeholder storage stakeholder,
            uint256 index
        ) = stakeholders.getWithIndex(addr);

        _withdraw(stakeholder, index);
    }

    function _withdraw(
        Stakeholding.Stakeholder storage stakeholder,
        uint256 index
    ) internal {
        uint256 reward = stakeholder.computeReward(yield);
        uint256 staked = stakeholder.totalStaked;

        stakeholders.removeAt(index);

        uint256 totalAmount = reward + staked;

        crunch.transfer(stakeholder.to, totalAmount);

        emit Withdrawed(stakeholder.to, reward, staked, totalAmount);
    }

    function _emergencyWithdraw(address addr) internal {
        (
            Stakeholding.Stakeholder storage stakeholder,
            uint256 index
        ) = stakeholders.getWithIndex(addr);

        _emergencyWithdraw(stakeholder, index);
    }

    function _emergencyWithdraw(
        Stakeholding.Stakeholder storage stakeholder,
        uint256 index
    ) internal {
        uint256 staked = stakeholder.totalStaked;

        stakeholders.removeAt(index);

        crunch.transfer(_msgSender(), staked);

        emit EmergencyWithdrawed(_msgSender(), staked);
    }

    function _transferRemainingAndSelfDestruct() internal {
        uint256 remaining = crunch.balanceOf(address(this));
        if (remaining != 0) {
            crunch.transfer(owner(), remaining);
        }

        selfdestruct(payable(owner()));
    }
}
