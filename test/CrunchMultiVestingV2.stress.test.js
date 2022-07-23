const advance = require("./helper/advance");
const blockHelper = require("./helper/block");
const timeHelper = require("./helper/time");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchMultiVestingV2 = artifacts.require("CrunchMultiVestingV2");

const ZERO = new BN(0);
const ONE_DAY = new BN(timeHelper.days(1));

contract("Crunch Multi Vesting V2 [ Stress ]", async ([owner, ...accounts]) => {
  let crunch;
  let multiVesting;

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    multiVesting = await CrunchMultiVestingV2.new(crunch.address);

    await crunch.transfer(multiVesting.address, await crunch.totalSupply());
  });

  // prettier-ignore
  const vestings = [
    { amount: 100, cliffDuration: 2, duration:  5 },
    { amount: 200, cliffDuration: 3, duration: 20 },
    { amount: 300, cliffDuration: 1, duration: 15 },
    { amount: 400, cliffDuration: 5, duration: 10 },
  ];

  const vestingsTotal = vestings.map(({ amount }) => amount).reduce((accumulator, value) => accumulator + value, 0);

  // prettier-ignore
  const cases = [
    { balance:   0 +   0 +  0  +   0, releasable: [          ] },
    { balance:   0 +   0 +  20 +   0, releasable: [      2   ] },
    { balance:  20 +   0 +  40 +   0, releasable: [0,    2   ] },
    { balance:  40 +  10 +  60 +   0, releasable: [0, 1, 2   ] },
    { balance:  60 +  20 +  80 +   0, releasable: [0, 1, 2   ] },
    { balance:  80 +  30 + 100 +  40, releasable: [0, 1, 2, 3] },
    { balance: 100 +  40 + 120 +  80, releasable: [0, 1, 2, 3] },
    { balance: 100 +  50 + 140 + 120, releasable: [   1, 2, 3] },
    { balance: 100 +  60 + 160 + 160, releasable: [   1, 2, 3] },
    { balance: 100 +  70 + 180 + 200, releasable: [   1, 2, 3] },
    { balance: 100 +  80 + 200 + 240, releasable: [   1, 2, 3] },
    { balance: 100 +  90 + 220 + 280, releasable: [   1, 2, 3] },
    { balance: 100 + 100 + 240 + 320, releasable: [   1, 2, 3] },
    { balance: 100 + 110 + 260 + 360, releasable: [   1, 2, 3] },
    { balance: 100 + 120 + 280 + 400, releasable: [   1, 2, 3] },
    { balance: 100 + 130 + 300 + 400, releasable: [   1, 2,  ] },
    { balance: 100 + 140 + 300 + 400, releasable: [   1,     ] },
    { balance: 100 + 150 + 300 + 400, releasable: [   1,     ] },
    { balance: 100 + 160 + 300 + 400, releasable: [   1,     ] },
    { balance: 100 + 170 + 300 + 400, releasable: [   1,     ] },
    { balance: 100 + 180 + 300 + 400, releasable: [   1,     ] },
    { balance: 100 + 190 + 300 + 400, releasable: [   1,     ] },
    { balance: 100 + 200 + 300 + 400, releasable: [   1,     ] },
    { balance: 100 + 200 + 300 + 400, releasable: [          ] },
  ];

  it("an account for everyone", async () => {
    const cliff = 2;
    const days = 10;

    const amount = new BN("100");
    const cliffDuration = timeHelper.days(cliff);
    const duration = timeHelper.days(days);

    for (const beneficiary of accounts) {
      await expect(multiVesting.vest(beneficiary, amount, cliffDuration, duration, false)).to.be.fulfilled;
    }

    await expect(multiVesting.beginNow()).to.be.fulfilled;

    for (let day = 0; day < days; day++) {
      for (const beneficiary of accounts) {
        const fromBeneficiary = { from: beneficiary };

        if (day <= cliff) {
          await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
        } else {
          await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.fulfilled;

          const expected = amount.divn(days).muln(day - cliff);
          await expect(crunch.balanceOf(beneficiary)).to.eventually.be.a.bignumber.equal(expected);
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

      await expect(multiVesting.vest(beneficiary, amount, cliffDuration, duration, false)).to.be.fulfilled;
    }

    await expect(multiVesting.beginNow()).to.be.fulfilled;

    for (let day = 0; day < cases.length; day++) {
      const expected = cases[day];
      // console.log({ case: expected });

      await advance.timeAndBlock(ONE_DAY);

      for (let index = 0; index < vestings.length; index++) {
        // const amount = await multiVesting.releasableAmount(new BN(`${index}`));
        // console.log({ index, amount: amount.toString(), included: expected.releasable.includes(index) });

        if (expected.releasable.includes(index)) {
          await expect(multiVesting.release(new BN(`${index}`), fromBeneficiary)).to.be.fulfilled;
        } else {
          await expect(multiVesting.release(new BN(`${index}`), fromBeneficiary)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
        }
      }

      await expect(crunch.balanceOf(beneficiary)).to.eventually.be.a.bignumber.equal(new BN(`${expected.balance}`));
    }

    const total = vestings.reduce((previous, current) => previous + current.amount, 0);

    await expect(crunch.balanceOf(beneficiary)).to.eventually.be.a.bignumber.equal(new BN(`${total}`));
  });

  it("a lot of vesting for everyone", async () => {
    /* reduce because its too long */
    const beneficiaries = accounts.slice(0, 4);

    for (const beneficiary of beneficiaries) {
      for (const vesting of vestings) {
        const amount = new BN(`${vesting.amount}`);
        const cliffDuration = new BN(`${timeHelper.days(vesting.cliffDuration)}`);
        const duration = new BN(`${timeHelper.days(vesting.duration)}`);

        await expect(multiVesting.vest(beneficiary, amount, cliffDuration, duration, false)).to.be.fulfilled;
      }
    }

    await expect(multiVesting.beginNow()).to.be.fulfilled;

    for (let day = 0; day < cases.length; day++) {
      const expected = cases[day];

      await advance.timeAndBlock(ONE_DAY);

      let id = 0;
      for (const beneficiary of beneficiaries) {
        const fromBeneficiary = { from: beneficiary };

        for (let index = 0; index < vestings.length; index++) {
          if (expected.releasable.includes(index)) {
            await expect(multiVesting.release(new BN(`${id}`), fromBeneficiary)).to.be.fulfilled;
          } else {
            await expect(multiVesting.release(new BN(`${id}`), fromBeneficiary)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
          }

          id++;
        }

        await expect(crunch.balanceOf(beneficiary)).to.eventually.be.a.bignumber.equal(new BN(`${expected.balance}`));
      }
    }

    const total = vestings.reduce((previous, current) => previous + current.amount, 0);

    for (const beneficiary of beneficiaries) {
      await expect(crunch.balanceOf(beneficiary)).to.eventually.be.a.bignumber.equal(new BN(`${total}`));
    }
  });

  it("a lot of transfer", async () => {
    const beneficiaries = accounts.slice(0, 6);
    const owners = {};

    let id = 0;
    for (const beneficiary of beneficiaries) {
      for (const vesting of vestings) {
        const amount = new BN(`${vesting.amount}`);
        const cliffDuration = new BN(`${timeHelper.days(vesting.cliffDuration)}`);
        const duration = new BN(`${timeHelper.days(vesting.duration)}`);

        await expect(multiVesting.vest(beneficiary, amount, cliffDuration, duration, false)).to.be.fulfilled;

        owners[id] = beneficiary;

        id++;
      }
    }

    id = 0;
    for (const index in beneficiaries) {
      const beneficiary = beneficiaries[+index];
      const next = beneficiaries[+index + 1] || beneficiaries[0];

      const fromBeneficiary = { from: beneficiary };

      for (const _ of new Array(2)) {
        await expect(multiVesting.transfer(next, id, fromBeneficiary)).to.be.fulfilled;
        owners[id] = next;

        id++;
      }

      id += 2;
    }

    id = 0;
    for (const index in beneficiaries) {
      const beneficiary = beneficiaries[+index];
      const previous = beneficiaries[+index - 1] || beneficiaries[beneficiaries.length - 1];

      const fromBeneficiary = { from: beneficiary };

      id += 2;

      for (const _ of new Array(2)) {
        await expect(multiVesting.transfer(previous, id, fromBeneficiary)).to.be.fulfilled;
        owners[id] = previous;

        id++;
      }
    }

    const ownedByAddress = Object.entries(owners).reduce((accumulator, [id, address]) => {
      if (!(address in accumulator)) {
        accumulator[address] = [];
      }

      accumulator[address].push(+id);

      return accumulator;
    }, {});

    for (const beneficiary of beneficiaries) {
      await expect(multiVesting.ownedCount(beneficiary)).to.be.eventually.a.bignumber.equals(new BN(vestings.length));

      const owned = [];
      for (const index in vestings) {
        owned.push((await multiVesting.owned(beneficiary, index)).toNumber());
      }

      expect(owned).to.have.members(ownedByAddress[beneficiary]);
    }

    await expect(multiVesting.totalSupply()).to.be.eventually.a.bignumber.equals(new BN(vestingsTotal * beneficiaries.length));

    await expect(multiVesting.beginAt(new BN(1))).to.be.fulfilled;

    for (const beneficiary of beneficiaries) {
      const fromBeneficiary = { from: beneficiary };

      await expect(multiVesting.balanceOf(beneficiary)).to.be.eventually.a.bignumber.equals(new BN(vestingsTotal));

      await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(beneficiary)).to.be.eventually.a.bignumber.equals(ZERO);
      await expect(crunch.balanceOf(beneficiary)).to.be.eventually.a.bignumber.equals(new BN(vestingsTotal));
    }

    await expect(multiVesting.totalSupply()).to.be.eventually.a.bignumber.equals(ZERO);
  });
});
