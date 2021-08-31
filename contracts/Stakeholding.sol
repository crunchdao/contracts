// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

library Stakeholding {
    struct Stake {
        uint256 amount;
        uint256 start;
    }

    struct Stakeholder {
        address to;
        uint256 totalStaked;
        uint256 rewardDebt;
        Stake[] stakes;
    }

    function find(Stakeholder[] storage stakeholders, address addr)
        public
        view
        returns (bool found, uint256 at)
    {
        for (uint256 index = 0; index < stakeholders.length; index += 1) {
            Stakeholder storage stakeholder = stakeholders[index];

            if (addr == stakeholder.to) {
                return (true, index);
            }
        }

        return (false, 0);
    }

    function getWithIndex(Stakeholder[] storage stakeholders, address addr)
        public
        view
        returns (Stakeholder storage, uint256)
    {
        (bool found, uint256 index) = find(stakeholders, addr);

        if (found) {
            return (stakeholders[index], index);
        }

        revert("Stakeholding: not in stakeholder list");
    }

    function get(Stakeholder[] storage stakeholders, address addr)
        public
        view
        returns (Stakeholder storage)
    {
        (Stakeholder storage stakeholder, ) = getWithIndex(stakeholders, addr);

        return stakeholder;
    }

    function add(Stakeholder[] storage stakeholders, address addr)
        public
        returns (Stakeholder storage)
    {
        (bool found, uint256 index) = find(stakeholders, addr);

        if (!found) {
            stakeholders.push();
            index = stakeholders.length - 1;

            Stakeholder storage stakeholder = stakeholders[index];
            stakeholder.to = addr;
        }

        return stakeholders[index];
    }

    function remove(Stakeholder[] storage stakeholders, address addr) public {
        (bool found, uint256 index) = find(stakeholders, addr);

        if (found) {
            removeAt(stakeholders, index);
        }
    }

    function removeAt(Stakeholder[] storage stakeholders, uint256 index)
        public
    {
        stakeholders[index] = stakeholders[stakeholders.length - 1];
        stakeholders.pop();
    }

    function computeTotalStaked(Stakeholder[] storage stakeholders)
        public
        view
        returns (uint256 total)
    {
        for (uint256 index = 0; index < stakeholders.length; index++) {
            Stakeholder storage stakeholder = stakeholders[index];

            total += stakeholder.totalStaked;
        }
    }

    function computeReward(Stakeholder[] storage stakeholders, uint256 yield)
        public
        view
        returns (uint256 reward)
    {
        for (uint256 index = 0; index < stakeholders.length; index++) {
            Stakeholder storage stakeholder = stakeholders[index];

            reward += computeReward(stakeholder, yield);
        }
    }

    function computeReward(Stakeholder storage stakeholder, uint256 yield)
        public
        view
        returns (uint256 reward)
    {
        for (uint256 index = 0; index < stakeholder.stakes.length; index++) {
            Stake storage stake = stakeholder.stakes[index];

            reward += computeReward(stake, yield);
        }

        reward += stakeholder.rewardDebt;
    }

    function computeReward(Stake storage stake, uint256 yield)
        public
        view
        returns (uint256)
    {
        uint256 numberOfDays = ((block.timestamp - stake.start) / 1 days);

        return stake.amount * numberOfDays * yield / 1_000_000;
    }

    function updateDebts(Stakeholder[] storage stakeholders, uint256 yield)
        public
        returns (uint256 totalDebt)
    {
        for (uint256 index = 0; index < stakeholders.length; index++) {
            Stakeholder storage stakeholder = stakeholders[index];

            totalDebt += updateDebts(stakeholder, yield);
        }
    }

    function updateDebts(Stakeholder storage stakeholder, uint256 yield)
        public
        returns (uint256 totalDebt)
    {
        for (uint256 index = 0; index < stakeholder.stakes.length; index++) {
            Stake storage stake = stakeholder.stakes[index];

            uint256 debt = computeReward(stake, yield);
            stakeholder.rewardDebt += debt;

            stake.start = block.timestamp;

            totalDebt += debt;
        }
    }

    function createStake(Stakeholder storage stakeholder, uint256 amount)
        public
    {
        stakeholder.stakes.push(
            Stake({amount: amount, start: block.timestamp})
        );
    }
}
