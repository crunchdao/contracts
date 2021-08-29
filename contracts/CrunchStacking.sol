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

    event WithdrawEvent(address _to, uint reward);

    uint256 public yield = 20;
    Stakeholder[] public stakeholders;
    CrunchToken crunch;
    
    constructor(CrunchToken _crunch) {
        crunch = _crunch;
    }

    function deposit(uint amount) public payable {
        // crunch.approve(address(this), amount);
        crunch.transferFrom(msg.sender, address(this), amount);
        
        Stakeholder storage stakeholder = addStakeholder(msg.sender);

        stakeholder.stakes.push(Stake({
            amount: amount,
            since: block.timestamp,
            debt: 0
        }));
    }

    function withdraw() public payable {
        (bool _isStakeholder, uint256 stakeholderIndex) = isStakeholder(
            msg.sender
        );

        if (!_isStakeholder) {
            revert("not currently stacking");
        }

        Stakeholder storage stakeholder = stakeholders[stakeholderIndex];
        uint reward = computeRewardOf(stakeholder);
        removeStakeholderAt(stakeholderIndex);

        emit WithdrawEvent(msg.sender, reward);
    }

    function computeReward(address _stakeholder) public view returns (uint256) {
        (bool _isStakeholder, uint256 stakeholderIndex) = isStakeholder(
            _stakeholder
        );

        if (!_isStakeholder) {
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
                (((block.timestamp - stake.since) / 1 seconds) * stake.amount) /
                yield;
        }

        return reward;
    }

    function setYield(uint256 to) public onlyOwner {
        require(yield != to, "yield value must be different");

        yield = to;
    }

    function isStakeholder(address _address)
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
        (bool _isStakeholder, uint256 index) = isStakeholder(_stakeholder);

        if (!_isStakeholder) {
            stakeholders.push();
            index = stakeholders.length - 1;
            
            Stakeholder storage stakeholder = stakeholders[index];
            stakeholder.to = _stakeholder;
        }

        return stakeholders[index];
    }

    function removeStakeholder(address _stakeholder) internal {
        (bool _isStakeholder, uint256 index) = isStakeholder(_stakeholder);

        if (_isStakeholder) {
            removeStakeholderAt(index);
        }
    }

    function removeStakeholderAt(uint256 index) internal {
        delete stakeholders[index];
    }
}
