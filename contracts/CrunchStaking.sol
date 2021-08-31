// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./Stakeholding.sol";
import "./IERC677Receiver.sol";
import "./HasCrunchParent.sol";
import "./CrunchToken.sol";

contract CrunchStaking is HasCrunchParent, IERC677Receiver {
    using Stakeholding for Stakeholding.Stakeholder[];
    using Stakeholding for Stakeholding.Stakeholder;
    using Stakeholding for Stakeholding.Stake;

    event YieldUpdated(uint256 yield, uint256 totalDebt);

    event WithdrawEvent(
        address indexed to,
        uint256 reward,
        uint256 staked,
        uint256 totalAmount
    );

    event EmergencyWithdrawEvent(address indexed to, uint256 staked);

    uint256 public yield;
    Stakeholding.Stakeholder[] public stakeholders;

    constructor(CrunchToken _crunch, uint256 _yield) HasCrunchParent(_crunch) {
        yield = _yield;
    }

    function deposit(uint256 amount) public {
        crunch.transferFrom(_msgSender(), address(this), amount);

        _deposit(_msgSender(), amount);
    }

    function withdraw() public {
        _withdraw(_msgSender());
    }

    function forceWithdraw(address addr) public onlyOwner {
        _withdraw(addr);
    }

    function emergencyWithdraw() public {
        _emergencyWithdraw(_msgSender());
    }

    function forceEmergencyWithdraw(address addr) public onlyOwner {
        _emergencyWithdraw(addr);
    }

    function setYield(uint256 to) public onlyOwner {
        require(yield != to, "Staking: yield value must be different");
        require(yield <= 400, "Staking: yield must be below 4%");

        uint256 debt = stakeholders.updateDebts(yield);
        yield = to;

        emit YieldUpdated(yield, debt);
    }

    function destroy() public onlyOwner {}

    function emergencyDestroy() public onlyOwner {}

    function totalStaked() public view returns (uint256) {
        return stakeholders.computeTotalStaked();
    }

    function totalStakedOf(address addr) public view returns (uint256) {
        return stakeholders.get(addr).totalStaked;
    }

    function totalReward() public view returns (uint256) {
        return stakeholders.computeReward(yield);
    }

    function totalRewardOf(address addr) public view returns (uint256) {
        return stakeholders.get(addr).computeReward(yield);
    }

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
        (Stakeholding.Stakeholder storage stakeholder, uint256 index) = stakeholders.getWithIndex(addr);

        uint256 reward = stakeholder.computeReward(yield);
        uint256 staked = stakeholder.totalStaked;

        stakeholders.removeAt(index);

        uint256 totalAmount = reward + staked;

        crunch.transfer(stakeholder.to, totalAmount);

        emit WithdrawEvent(stakeholder.to, reward, staked, totalAmount);
    }

    function _emergencyWithdraw(address addr) internal {
        (Stakeholding.Stakeholder storage stakeholder, uint256 index) = stakeholders.getWithIndex(addr);

        uint256 staked = stakeholder.totalStaked;

        stakeholders.removeAt(index);

        crunch.transfer(_msgSender(), staked);

        emit EmergencyWithdrawEvent(_msgSender(), staked);
    }
}
