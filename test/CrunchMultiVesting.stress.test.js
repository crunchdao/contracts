const advance = require("./helper/advance");
const blockHelper = require("./helper/block");
const timeHelper = require("./helper/time");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchMultiVesting = artifacts.require("CrunchMultiVesting");

const ONE_DAY = new BN(timeHelper.days(1));

contract("Crunch Multi Vesting", async ([owner, ...accounts]) => {
  let crunch;
  let multiVesting;

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    multiVesting = await CrunchMultiVesting.new(crunch.address);

    await crunch.transfer(multiVesting.address, await crunch.totalSupply());
  });

  // prettier-ignore
  const vestings = [
    { amount: 100, cliffDuration: 2, duration: 5 },
    { amount: 200, cliffDuration: 3, duration: 20 },
    { amount: 300, cliffDuration: 1, duration: 15 },
    { amount: 400, cliffDuration: 5, duration: 10 },
  ];

  // prettier-ignore
  const cases = [
    { balance:   0 +   0 +  20 +   0, indexes: [0, 1, 2, 3], releasable: [2] },
    { balance:  40 +   0 +  40 +   0, indexes: [0, 1, 2, 3], releasable: [0, 2] },
    { balance:  60 +  30 +  60 +   0, indexes: [0, 1, 2, 3], releasable: [0, 1, 2] },
    { balance:  80 +  40 +  80 +   0, indexes: [0, 1, 2, 3], releasable: [0, 1, 2] },
    { balance: 100 +  50 + 100 + 200, indexes: [3, 1, 2],    releasable: [0, 1, 2, 3] },
    { balance: 100 +  60 + 120 + 240, indexes: [3, 1, 2],    releasable: [1, 2, 3] },
    { balance: 100 +  70 + 140 + 280, indexes: [3, 1, 2],    releasable: [1, 2, 3] },
    { balance: 100 +  80 + 160 + 320, indexes: [3, 1, 2],    releasable: [1, 2, 3] },
    { balance: 100 +  90 + 180 + 360, indexes: [3, 1, 2],    releasable: [1, 2, 3] },
    { balance: 100 + 100 + 200 + 400, indexes: [2, 1],       releasable: [1, 2, 3] },
    { balance: 100 + 110 + 220 + 400, indexes: [2, 1],       releasable: [1, 2] },
    { balance: 100 + 120 + 240 + 400, indexes: [2, 1],       releasable: [1, 2] },
    { balance: 100 + 130 + 260 + 400, indexes: [2, 1],       releasable: [1, 2] },
    { balance: 100 + 140 + 280 + 400, indexes: [2, 1],       releasable: [1, 2] },
    { balance: 100 + 150 + 300 + 400, indexes: [1],          releasable: [1, 2] },
    { balance: 100 + 160 + 300 + 400, indexes: [1],          releasable: [1] },
    { balance: 100 + 170 + 300 + 400, indexes: [1],          releasable: [1] },
    { balance: 100 + 180 + 300 + 400, indexes: [1],          releasable: [1] },
    { balance: 100 + 190 + 300 + 400, indexes: [1],          releasable: [1] },
    { balance: 100 + 200 + 300 + 400, indexes: [],           releasable: [1] },
    { balance: 100 + 200 + 300 + 400, indexes: [],           releasable: [] },
  ];

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

  it("a lot of vesting", async () => {
    const [beneficiary] = accounts;

    const fromBeneficiary = { from: beneficiary };

    for (const vesting of vestings) {
      const amount = new BN(`${vesting.amount}`);
      const cliffDuration = new BN(`${timeHelper.days(vesting.cliffDuration)}`);
      const duration = new BN(`${timeHelper.days(vesting.duration)}`);

      await expect(
        multiVesting.create(beneficiary, amount, cliffDuration, duration)
      ).to.be.fulfilled;
    }

    for (let day = 0; day < cases.length; day++) {
      const expected = cases[day];

      await advance.timeAndBlock(ONE_DAY);

      for (let index = 0; index < vestings.length; index++) {
        if (expected.releasable.includes(index)) {
          await expect(
            multiVesting.release(new BN(`${index}`), fromBeneficiary)
          ).to.be.fulfilled;
        } else {
          await expect(
            multiVesting.release(new BN(`${index}`), fromBeneficiary)
          ).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
        }
      }

      await expect(
        crunch.balanceOf(beneficiary)
      ).to.eventually.be.a.bignumber.equal(new BN(`${expected.balance}`));

      expect(
        (await multiVesting.activeVestingsIndex(beneficiary)).map((x) =>
          x.toNumber()
        )
      ).to.be.deep.equal(expected.indexes);
    }

    const total = vestings.reduce(
      (previous, current) => previous + current.amount,
      0
    );

    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN(`${total}`));
  });

  it("a lot of vesting for everyone", async () => {
    /* reduce because its too long */
    const beneficiaries = accounts.slice(0, 4);

    for (const beneficiary of beneficiaries) {
      for (const vesting of vestings) {
        const amount = new BN(`${vesting.amount}`);
        const cliffDuration = new BN(
          `${timeHelper.days(vesting.cliffDuration)}`
        );
        const duration = new BN(`${timeHelper.days(vesting.duration)}`);

        await expect(
          multiVesting.create(beneficiary, amount, cliffDuration, duration)
        ).to.be.fulfilled;
      }
    }

    for (let day = 0; day < cases.length; day++) {
      const expected = cases[day];

      await advance.timeAndBlock(ONE_DAY);

      for (const beneficiary of beneficiaries) {
        const fromBeneficiary = { from: beneficiary };

        for (let index = 0; index < vestings.length; index++) {
          if (expected.releasable.includes(index)) {
            await expect(
              multiVesting.release(new BN(`${index}`), fromBeneficiary)
            ).to.be.fulfilled;
          } else {
            await expect(
              multiVesting.release(new BN(`${index}`), fromBeneficiary)
            ).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
          }
        }

        await expect(
          crunch.balanceOf(beneficiary)
        ).to.eventually.be.a.bignumber.equal(new BN(`${expected.balance}`));

        expect(
          (await multiVesting.activeVestingsIndex(beneficiary)).map((x) =>
            x.toNumber()
          )
        ).to.be.deep.equal(expected.indexes);
      }
    }

    const total = vestings.reduce(
      (previous, current) => previous + current.amount,
      0
    );

    for (const beneficiary of beneficiaries) {
      await expect(
        crunch.balanceOf(beneficiary)
      ).to.eventually.be.a.bignumber.equal(new BN(`${total}`));
    }
  });
});
