const advance = require("./helper/advance");
const blockHelper = require("./helper/block");
const timeHelper = require("./helper/time");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchMultiVesting = artifacts.require("CrunchMultiVesting");

const NULL = "0x0000000000000000000000000000000000000000";
const ZERO = new BN("0");
const ONE = new BN("1");
const TWO = new BN("2");
const FOUR = new BN("4");
const SIX = new BN("6");
const EIGHT = new BN("8");
const TEN = new BN("10");
const TWENTY = new BN("20");
const ONE_YEAR = new BN(timeHelper.years(1));
const TWO_YEARS = new BN(timeHelper.years(2));
const THREE_YEARS = new BN(timeHelper.years(3));
const ONE_DAY = new BN(timeHelper.days(1));
const TWO_DAYS = new BN(timeHelper.days(2));
const THREE_DAYS = new BN(timeHelper.days(3));
const TEN_DAYS = new BN(timeHelper.days(10));

contract("Crunch Multi Vesting", async ([owner, ...accounts]) => {
  let crunch;
  let multiVesting;

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    multiVesting = await CrunchMultiVesting.new(crunch.address);

    await crunch.transfer(multiVesting.address, await crunch.totalSupply());
  });

  it("an account for everyone", async () => {
    const cliff = 2;
    const days = 10;

    const amount = new BN("100");
    const cliffDuration = timeHelper.days(cliff);
    const duration = timeHelper.days(days);

    for (const beneficiary of accounts) {
      await expect(
        multiVesting.create(beneficiary, amount, cliffDuration, duration)
      ).to.be.fulfilled;
    }

    for (let day = 0; day < days; day++) {
      for (const beneficiary of accounts) {
        const fromBeneficiary = { from: beneficiary };

        if (day < cliff) {
          await expect(
            multiVesting.releaseAll(fromBeneficiary)
          ).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
        } else {
          await expect(multiVesting.releaseAll(fromBeneficiary)).to.be
            .fulfilled;

          const expected = amount.divn(days).muln(day);
          await expect(
            crunch.balanceOf(beneficiary)
          ).to.eventually.be.a.bignumber.equal(expected);
        }
      }

      await advance.timeAndBlock(ONE_DAY);
    }
  });
});
