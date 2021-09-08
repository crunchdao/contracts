const util = require("util");

const advance = require("./helper/advance");
const time = require("./helper/time");
const { expect, BN } = require("./helper/chai");
const { shuffle } = require("./helper/shuffle");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchStaking = artifacts.require("CrunchStaking");

const REWARD_PER_DAY_1_PERCENT_PER_MONTH = 325.5;

contract("Crunch Staking [ Stress ]", async (accounts) => {
  let crunch;
  let staking;

  const [owner, ...stakers] = accounts;
  const initialStakerBalance = 10000;

  const deposit = async (from, amount) =>
    await expect(
      crunch.transferAndCall(staking.address, amount, "0x0", { from })
    ).to.be.fulfilled;

  const isStaking = async (stakers) => {
    for (const staker of stakers) {
      await expect(staking.isStaking(staker)).to.eventually.be.true;
    }
  };

  const isNotStaking = async (stakers) => {
    for (const staker of stakers) {
      await expect(staking.isStaking(staker)).to.eventually.be.false;
    }
  };

  const rewardOf = async (staker, expected) => {
    await expect(
      staking.totalRewardOf(staker)
    ).to.eventually.be.a.bignumber.equal(new BN(expected));
  };

  const withdraw = async (from) =>
    await expect(staking.withdraw({ from })).to.be.fulfilled;

  const nextMonth = async (month = 1) =>
    await advance.timeAndBlock(time.days(31 * month));

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    staking = await CrunchStaking.new(
      crunch.address,
      REWARD_PER_DAY_1_PERCENT_PER_MONTH * 2
    );

    for (const staker of stakers) {
      await crunch.transfer(staker, initialStakerBalance);
    }
  });

  it("deposit & withdraw", async () => {
    const amount = 100;

    await crunch.transfer(staking.address, 10_000);

    for (const staker of stakers) {
      await deposit(staker, amount);
    }

    await isStaking(stakers);

    const unordered = shuffle(stakers);
    for (let month = 0; month < unordered.length; month++) {
      const staker = unordered[month];

      await rewardOf(staker, Math.floor(month * amount * 0.02));

      await isStaking(unordered.slice(month, unordered.length));

      await withdraw(staker);

      await isNotStaking(unordered.slice(0, month));

      await nextMonth();
    }
  });

  it("deposit & withdraw : no reserve for rewards", async () => {
    const amount = 100;

    for (const staker of stakers) {
      await deposit(staker, amount);
    }

    await isStaking(stakers);

    const unordered = shuffle(stakers);
    for (let month = 0; month < unordered.length; month++) {
      const staker = unordered[month];

      await rewardOf(staker, Math.floor(month * amount * 0.02));

      await isStaking([staker]);

      await expect(staking.withdraw({ from })).to.be.rejected;

      await isStaking([staker]);

      await nextMonth();
    }
  });

  it("setRewardPerDay(uint256)", async () => {
    const amount = 100;

    for (const staker of stakers) {
      await deposit(staker, amount);

      await nextMonth();
    }

    for (let index = 0; index < stakers.length; index++) {
      const staker = stakers[index];

      const at2Percent = Math.floor((stakers.length - index) * amount * 0.02);

      await rewardOf(staker, at2Percent);
    }

    const tests = [0.06, 0.1, 0.15, 0.1, 0.04];

    const wait = 4; /* month */

    for (let testIndex = 0; testIndex < tests.length; testIndex++) {
      await expect(
        staking.setRewardPerDay(
          Math.floor(
            REWARD_PER_DAY_1_PERCENT_PER_MONTH * (tests[testIndex] * 100)
          )
        )
      ).to.be.fulfilled;

      for (let index = 0; index < stakers.length; index++) {
        const staker = stakers[index];

        const at2Percent = Math.floor((stakers.length - index) * amount * 0.02);

        let sum = 0;
        for (let testSumIndex = 0; testSumIndex < testIndex; testSumIndex++) {
          sum += Math.floor(wait * amount * tests[testSumIndex]);
        }

        await rewardOf(staker, at2Percent + sum);
      }

      await nextMonth(wait);
    }
  });
});
