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
        uint256 debt,
        uint256 totalAmount
    );

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
        (bool found, uint256 index) = stakeholders.find(_msgSender());

        if (!found) {
            revert("not currently stacking");
        }

        Stakeholding.Stakeholder storage stakeholder = stakeholders[index];

        uint256 reward = stakeholder.computeReward(yield);
        uint256 staked = stakeholder.computeTotalStaked();
        uint256 debt = stakeholder.computeTotalDebt();

        stakeholders.removeAt(index);

        uint256 totalAmount = reward + staked + debt;

        crunch.transfer(_msgSender(), totalAmount);

        emit WithdrawEvent(_msgSender(), reward, staked, debt, totalAmount);
    }

    function setYield(uint256 to) public onlyOwner {
        require(yield != to, "yield value must be different");
        require(yield <= 400, "yield must be below 4%");

        uint totalDebt = stakeholders.updateDebts(yield);
        yield = to;

        emit YieldUpdated(yield, totalDebt);
    }

    function totalStaked() public view returns (uint256) {
        return stakeholders.computeTotalStaked();
    }

    function totalStakedOf(address addr) public view returns (uint256) {
        (bool found, uint256 index) = stakeholders.find(addr);

        if (!found) {
            return 0;
        }

        return stakeholders[index].computeTotalStaked();
    }

    function totalReward() public view returns (uint256) {
        return stakeholders.computeReward(yield);
    }

    function totalRewardOf(address addr) public view returns (uint256) {
        (bool found, uint256 index) = stakeholders.find(addr);

        if (!found) {
            return 0;
        }

        return stakeholders[index].computeReward(yield);
    }

    function isStaking(address addr) public view returns (bool) {
        (bool found, ) = stakeholders.find(addr);

        return found;
    }

    function updateDepts() internal onlyOwner returns (uint256 totalDept) {
        return stakeholders.updateDebts(yield);
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
}
