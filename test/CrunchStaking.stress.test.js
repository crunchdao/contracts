const util = require("util");

const advance = require("./helper/advance");
const time = require("./helper/time");
const { expect, BN } = require("./helper/chai");
const { shuffle } = require("./helper/shuffle");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchStaking = artifacts.require("CrunchStaking");

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

  const nextMonth = async () => await advance.timeAndBlock(time.days(31));

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    staking = await CrunchStaking.new(crunch.address, 657);

    for (const staker of stakers) {
      await crunch.transfer(staker, initialStakerBalance);
    }
  });

  it("deposit & withdraw", async () => {
    const amount = 100;

    {
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
    }
  });

  it("deposit & withdraw", async () => {
    const amount = 100;

    {
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
    }
  });
});
