// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./IERC677Receiver.sol";

import "./HasCrunchParent.sol";
import "./CrunchToken.sol";

contract CrunchStaking is HasCrunchParent, IERC677Receiver {
    struct Stake {
        uint256 amount;
        uint256 since;
        uint256 debt;
    }

    struct Stakeholder {
        address to;
        Stake[] stakes;
    }

    event YieldUpdated(uint256 value);
    event WithdrawEvent(address _to, uint256 reward);

    uint256 public yield;
    Stakeholder[] public stakeholders;

    constructor(CrunchToken _crunch, uint256 _yield) HasCrunchParent(_crunch) {
        yield = _yield;
    }

    function deposit(uint256 amount) public payable {
        crunch.transferFrom(msg.sender, address(this), amount);

        _deposit(msg.sender, amount);
    }

    function withdraw() public payable {
        (bool found, uint256 stakeholderIndex) = findStakeholder(msg.sender);

        if (!found) {
            revert("not currently stacking");
        }

        Stakeholder storage stakeholder = stakeholders[stakeholderIndex];
        uint256 reward = computeRewardOf(stakeholder);
        removeStakeholderAt(stakeholderIndex);

        emit WithdrawEvent(msg.sender, reward);
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
        Stakeholder storage stakeholder = addStakeholder(from);

        stakeholder.stakes.push(
            Stake({amount: amount, since: block.timestamp, debt: 0})
        );
    }

    function totalReward() public view returns (uint256) {
        uint256 reward = 0;

        for (uint256 index = 0; index < stakeholders.length; index++) {
            Stakeholder storage stakeholder = stakeholders[index];

            reward += computeRewardOf(stakeholder);
        }

        return reward;
    }

    function computeReward(address _stakeholder) public view returns (uint256) {
        (bool found, uint256 stakeholderIndex) = findStakeholder(_stakeholder);

        if (!found) {
            return 0;
        }

        Stakeholder storage stakeholder = stakeholders[stakeholderIndex];
        return computeRewardOf(stakeholder);
    }

    function computeRewardOf(Stakeholder storage stakeholder)
        internal
        view
        returns (uint256)
    {
        uint256 reward = 0;

        for (uint256 index = 0; index < stakeholder.stakes.length; index++) {
            Stake storage stake = stakeholder.stakes[index];

            reward += computeStakeReward(stake);
        }

        return reward;
    }

    function computeStakeReward(Stake storage stake)
        internal
        view
        returns (uint256)
    {
        return
            ((((block.timestamp - stake.since) / 30 days) * stake.amount) /
                yield) + stake.debt;
    }

    function setYield(uint256 to) public onlyOwner {
        require(yield != to, "yield value must be different");

        updateDepts();
        yield = to;

        emit YieldUpdated(to);
    }

    function isStakeholder(address _address) public view returns (bool) {
        (bool found, ) = findStakeholder(_address);

        return found;
    }

    function updateDepts() internal returns (uint256 totalDept) {
        for (uint256 index = 0; index < stakeholders.length; index++) {
            totalDept += updateDeptsOf(stakeholders[index]);
        }
    }

    function updateDeptsOf(Stakeholder storage stakeholder)
        internal
        returns (uint256 totalDept)
    {
        for (uint256 index = 0; index < stakeholder.stakes.length; index++) {
            Stake storage stake = stakeholder.stakes[index];

            stake.debt += computeStakeReward(stake);
            stake.since = block.timestamp;

            totalDept += stake.debt;
        }
    }

    function findStakeholder(address _address)
        internal
        view
        returns (bool, uint256)
    {
        for (uint256 index = 0; index < stakeholders.length; index += 1) {
            if (_address == stakeholders[index].to) return (true, index);
        }

        return (false, 0);
    }

    function addStakeholder(address _stakeholder)
        internal
        returns (Stakeholder storage)
    {
        (bool found, uint256 index) = findStakeholder(_stakeholder);

        if (!found) {
            stakeholders.push();
            index = stakeholders.length - 1;

            Stakeholder storage stakeholder = stakeholders[index];
            stakeholder.to = _stakeholder;
        }

        return stakeholders[index];
    }

    function removeStakeholder(address _stakeholder) internal {
        (bool found, uint256 index) = findStakeholder(_stakeholder);

        if (found) {
            removeStakeholderAt(index);
        }
    }

    function removeStakeholderAt(uint256 index) internal {
        delete stakeholders[index];
    }
}
