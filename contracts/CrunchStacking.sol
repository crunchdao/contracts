// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

import "./CrunchToken.sol";

contract CrunchStacking is Ownable {
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

    CrunchToken crunch;
    uint256 public yield;
    Stakeholder[] public stakeholders;

    constructor(CrunchToken _crunch, uint256 _yield) {
        crunch = _crunch;
        yield = _yield;
    }

    function deposit(uint256 amount) public payable {
        Stakeholder storage stakeholder = addStakeholder(msg.sender);

        stakeholder.stakes.push(
            Stake({amount: amount, since: block.timestamp, debt: 0})
        );
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

            reward +=
                (((block.timestamp - stake.since) / 30 days) * stake.amount) /
                yield;
        }

        return reward;
    }

    function setYield(uint256 to) public onlyOwner {
        require(yield != to, "yield value must be different");

        yield = to;

        emit YieldUpdated(to);
    }

    function isStakeholder(address _address) public view returns (bool) {
        (bool found, ) = findStakeholder(_address);

        return found;
    }

    function findStakeholder(address _address)
        public
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
