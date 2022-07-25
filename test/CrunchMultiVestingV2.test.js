const advance = require("./helper/advance");
const blockHelper = require("./helper/block");
const timeHelper = require("./helper/time");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchMultiVestingV2 = artifacts.require("CrunchMultiVestingV2");

const NULL = "0x0000000000000000000000000000000000000000";
const ZERO = new BN("0");
const ONE = new BN("1");
const TWO = new BN("2");
const THREE = new BN("3");
const FOUR = new BN("4");
const TEN = new BN("10");
const ONE_YEAR = new BN(timeHelper.years(1));
const TWO_YEAR = new BN(timeHelper.years(2));

const ONE_CRUNCH = new BN("1000000000000000000");

function expectVesting(got, expected) {
  expect(got.id).to.be.a.bignumber.equal(expected.id);
  expect(got.beneficiary).to.be.equal(expected.beneficiary);
  expect(got.amount).to.be.a.bignumber.equal(expected.amount);
  expect(got.cliffDuration).to.be.a.bignumber.equal(expected.cliffDuration);
  expect(got.duration).to.be.a.bignumber.equal(expected.duration);
  expect(got.revocable).to.be.equal(expected.revocable);
  expect(got.revoked).to.be.equal(expected.revoked);
  expect(got.released).to.be.a.bignumber.equal(expected.released);
}

contract("Crunch Multi Vesting V2", async ([owner, user, ...accounts]) => {
  const fromUser = { from: user };

  let crunch;
  let multiVesting;

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    multiVesting = await CrunchMultiVestingV2.new(crunch.address);
  });

  it("initial state", async () => {
    await expect(multiVesting.owner()).to.eventually.be.equal(owner);
    await expect(multiVesting.startDate()).to.eventually.a.bignumber.equal(ZERO);
    await expect(multiVesting.parentToken()).to.eventually.equal(crunch.address);
  });

  it("name()", async () => {
    await expect(multiVesting.name()).to.eventually.be.equal("Vested CRUNCH Token v2 (multi)");
  });

  it("symbol()", async () => {
    await expect(multiVesting.symbol()).to.eventually.be.equal("mvCRUNCH");
  });

  it("decimals()", async () => {
    await expect(multiVesting.decimals()).to.eventually.be.a.bignumber.equal(await crunch.decimals());
  });

  it("reserve()", async () => {
    const amount = new BN("10000");

    await expect(multiVesting.reserve()).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(crunch.transfer(multiVesting.address, amount)).to.be.fulfilled;

    await expect(multiVesting.reserve()).to.eventually.be.a.bignumber.equal(amount);
  });

  it("availableReserve()", async () => {
    const amount = new BN("10000");
    const half = amount.divn(2);

    await expect(multiVesting.availableReserve()).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(crunch.transfer(multiVesting.address, amount)).to.be.fulfilled;

    await expect(multiVesting.availableReserve()).to.eventually.be.a.bignumber.equal(amount);

    await expect(multiVesting.vest(owner, half, timeHelper.years(1), timeHelper.years(1), true)).to.be.fulfilled;

    await expect(multiVesting.availableReserve()).to.eventually.be.a.bignumber.equal(half);
  });

  describe("beginNow()", () => {
    it("ok", async () => {
      const transaction = await expect(multiVesting.beginNow()).to.be.fulfilled;
      const { blockNumber } = transaction.receipt;
      const { timestamp } = await blockHelper.get(blockNumber);

      await expect(multiVesting.startDate()).to.eventually.a.bignumber.equal(new BN(timestamp));
    });

    it("only owner", async () => {
      await expect(multiVesting.beginNow(fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("cannot be called twice", async () => {
      await expect(multiVesting.beginNow()).to.be.fulfilled;
      await expect(multiVesting.beginNow()).to.be.rejectedWith(Error, "MultiVesting: already started");
    });
  });

  describe("beginAt(uint256)", () => {
    const timestamp = new BN(1234);

    it("ok", async () => {
      await expect(multiVesting.beginAt(timestamp)).to.be.fulfilled;
      await expect(multiVesting.startDate()).to.eventually.a.bignumber.equal(new BN(timestamp));
    });

    it("timestamp=0", async () => {
      await expect(multiVesting.beginAt(ZERO)).to.be.rejectedWith(Error, "MultiVesting: timestamp cannot be zero");
    });

    it("only owner", async () => {
      await expect(multiVesting.beginAt(timestamp, fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("cannot be called twice", async () => {
      await expect(multiVesting.beginAt(timestamp)).to.be.fulfilled;
      await expect(multiVesting.beginAt(timestamp)).to.be.rejectedWith(Error, "MultiVesting: already started");
    });
  });

  describe("vest(address, uint256, uint256, uint256)", () => {
    it("beneficiary=0x0", async () => {
      await expect(multiVesting.vest(NULL, ONE, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: beneficiary is the zero address");
    });

    it("amount=0", async () => {
      await expect(multiVesting.vest(owner, ZERO, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: amount is 0");
    });

    it("duration=0", async () => {
      await expect(multiVesting.vest(owner, ONE, ZERO, ZERO, true)).to.be.rejectedWith(Error, "MultiVesting: duration is 0");
    });

    it("no reserve", async () => {
      await expect(multiVesting.vest(owner, TWO, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: available reserve is not enough");

      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(owner, TWO, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: available reserve is not enough");

      await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;
    });

    it("after started", async () => {
      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await expect(multiVesting.vest(owner, TWO, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: already started");
    });

    it("not the owner", async () => {
      await expect(multiVesting.vest(owner, TWO, ONE, ONE, true, fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vest(user, ONE, TWO, THREE, true)).to.be.fulfilled;

      await expect(multiVesting.isVested(user)).to.be.eventually.true;

      const vesting = await multiVesting.vestings(ZERO);
      expectVesting(vesting, {
        id: ZERO,
        beneficiary: user,
        amount: ONE,
        cliffDuration: TWO,
        duration: THREE,
        revocable: true,
        revoked: false,
        released: ZERO,
      });
    });

    it("multiple", async () => {
      await expect(crunch.transfer(multiVesting.address, THREE)).to.be.fulfilled;

      for (let index = 0; index < 3; index++) {
        await expect(multiVesting.vest(user, ONE, TWO, THREE, true)).to.be.fulfilled;

        const id = new BN(index);

        const vesting = await multiVesting.vestings(id);
        expectVesting(vesting, {
          id: id,
          beneficiary: user,
          amount: ONE,
          cliffDuration: TWO,
          duration: THREE,
          revocable: true,
          revoked: false,
          released: ZERO,
        });
      }
    });
  });

  describe("vestMultiple(address[], uint256[], uint256, uint256)", () => {
    it("beneficiaries=[0x0]", async () => {
      await expect(multiVesting.vestMultiple([NULL], [ONE], ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: beneficiary is the zero address");
    });

    it("beneficiaries=[0x1, 0x0]", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vestMultiple([owner, NULL], [ONE, ONE], ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: beneficiary is the zero address");
    });

    it("amounts=[0]", async () => {
      await expect(multiVesting.vestMultiple([owner], [ZERO], ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: amount is 0");
    });

    it("amounts=[1, 0]", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vestMultiple([owner, user], [ONE, ZERO], ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: amount is 0");
    });

    it("beneficiaries.length != amounts.length", async () => {
      await expect(multiVesting.vestMultiple([NULL], [ONE], ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: beneficiary is the zero address");
    });

    it("beneficiaries.length == 0", async () => {
      await expect(multiVesting.vestMultiple([], [], ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: must vest at least one person");
    });

    it("duration=0", async () => {
      await expect(multiVesting.vestMultiple([owner, user], [ONE], ZERO, ZERO, true)).to.be.rejectedWith(Error, "MultiVesting: arrays are not the same length");
    });

    it("after started", async () => {
      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await expect(multiVesting.vestMultiple([owner], [ONE], ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: already started");
    });

    it("not the owner", async () => {
      await expect(multiVesting.vestMultiple([owner], [ONE], ONE, ONE, true, fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("no reserve", async () => {
      await expect(multiVesting.vestMultiple([owner, owner], [ONE, ONE], ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: available reserve is not enough");

      await expect(crunch.transfer(multiVesting.address, TWO)).to.be.fulfilled;

      await expect(multiVesting.vestMultiple([owner, owner, owner], [ONE, ONE, ONE], ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: available reserve is not enough");

      await expect(multiVesting.vestMultiple([owner, owner], [ONE, ONE], ONE, ONE, true)).to.be.fulfilled;
      await expect(multiVesting.ownedCount(owner)).to.be.eventually.a.bignumber.equals(TWO);
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, THREE)).to.be.fulfilled;
      await expect(multiVesting.vestMultiple([owner, user], [ONE, TWO], TWO, THREE, true)).to.be.fulfilled;

      await expect(multiVesting.isVested(owner)).to.be.eventually.true;
      await expect(multiVesting.isVested(user)).to.be.eventually.true;

      expectVesting(await multiVesting.vestings(ZERO), {
        id: ZERO,
        beneficiary: owner,
        amount: ONE,
        cliffDuration: TWO,
        duration: THREE,
        revocable: true,
        revoked: false,
        released: ZERO,
      });

      expectVesting(await multiVesting.vestings(ONE), {
        id: ONE,
        beneficiary: user,
        amount: TWO,
        cliffDuration: TWO,
        duration: THREE,
        revocable: true,
        revoked: false,
        released: ZERO,
      });
    });

    it("multiple", async () => {
      await expect(crunch.transfer(multiVesting.address, THREE)).to.be.fulfilled;

      await expect(multiVesting.vestMultiple([user, user, user], [ONE, ONE, ONE], TWO, THREE, true)).to.be.fulfilled;

      for (let index = 0; index < 3; index++) {
        const id = new BN(index);

        const vesting = await multiVesting.vestings(id);
        expectVesting(vesting, {
          id: id,
          beneficiary: user,
          amount: ONE,
          cliffDuration: TWO,
          duration: THREE,
          revocable: true,
          revoked: false,
          released: ZERO,
        });
      }
    });
  });

  describe("transfer(address)", () => {
    it("unknown vesting", async () => {
      await expect(multiVesting.transfer(user, ZERO)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });

    it("not the owner", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.transfer(user, ZERO, fromUser)).to.be.rejectedWith(Error, "MultiVesting: not the beneficiary");
    });

    it("to=self", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.transfer(owner, ZERO)).to.be.rejectedWith(Error, "MultiVesting: cannot transfer to itself");
    });

    it("to=0x0", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.transfer(NULL, ZERO)).to.be.rejectedWith(Error, "MultiVesting: target is the zero address");
    });

    it("ok", async () => {
      const id = ZERO;

      await expect(crunch.transfer(multiVesting.address, TWO)).to.be.fulfilled;

      await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.transfer(user, id)).to.be.fulfilled;

      await expect(multiVesting.isVested(owner)).to.be.eventually.false;
      await expect(multiVesting.isVested(user)).to.be.eventually.true;

      const vesting = await multiVesting.vestings(id);
      expectVesting(vesting, {
        id,
        beneficiary: user,
        amount: ONE,
        cliffDuration: ONE,
        duration: ONE,
        revocable: true,
        revoked: false,
        released: ZERO,
      });
    });
  });

  describe("release(uint256)", () => {
    it("not existing", async () => {
      await expect(multiVesting.release(ZERO, fromUser)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
      await expect(multiVesting.release(ONE, fromUser)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });

    it("must be the beneficiary", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.release(ZERO, fromUser)).to.be.rejectedWith(Error, "MultiVesting: not the beneficiary");
    });

    it("no token are due", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(user, ONE, ONE, timeHelper.days(1), true)).to.be.fulfilled;

      await expect(multiVesting.release(ZERO, fromUser)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await expect(multiVesting.release(ZERO, fromUser)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;

      await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await advance.timeAndBlock(timeHelper.days(2));

      await expect(multiVesting.release(ZERO, fromUser)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");

      await advance.timeAndBlock(timeHelper.days(1));

      await expect(multiVesting.release(ZERO, fromUser)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(9));
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(1));

      await advance.timeAndBlock(timeHelper.days(4));

      await expect(multiVesting.release(ZERO, fromUser)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(5));
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(5));

      await advance.timeAndBlock(timeHelper.days(5));

      await expect(multiVesting.release(ZERO, fromUser)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(ZERO);
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(TEN);
    });
  });

  describe("releaseAll()", () => {
    it("nothing is due", async () => {
      await expect(multiVesting.releaseAll(fromUser)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, TEN.muln(2))).to.be.fulfilled;

      await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;
      await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await advance.timeAndBlock(timeHelper.days(2));

      await expect(multiVesting.releaseAll(fromUser)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");

      await advance.timeAndBlock(timeHelper.days(1));

      await expect(multiVesting.releaseAll(fromUser)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(9).muln(2));
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(1).muln(2));

      await advance.timeAndBlock(timeHelper.days(4));

      await expect(multiVesting.releaseAll(fromUser)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(5).muln(2));
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(5).muln(2));

      await advance.timeAndBlock(timeHelper.days(5));

      await expect(multiVesting.releaseAll(fromUser)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(ZERO);
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(TEN.muln(2));
    });
  });

  describe("releaseFor(uint256)", () => {
    it("not the owner", async () => {
      await expect(multiVesting.releaseFor(ZERO, fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("not existing", async () => {
      await expect(multiVesting.releaseFor(ZERO)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
      await expect(multiVesting.releaseFor(ONE)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });

    it("no token are due", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(user, ONE, ONE, timeHelper.days(1), true)).to.be.fulfilled;

      await expect(multiVesting.releaseFor(ZERO)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await expect(multiVesting.releaseFor(ZERO)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;

      await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await advance.timeAndBlock(timeHelper.days(2));

      await expect(multiVesting.releaseFor(ZERO)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");

      await advance.timeAndBlock(timeHelper.days(1));

      await expect(multiVesting.releaseFor(ZERO)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(9));
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(1));

      await advance.timeAndBlock(timeHelper.days(4));

      await expect(multiVesting.releaseFor(ZERO)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(5));
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(5));

      await advance.timeAndBlock(timeHelper.days(5));

      await expect(multiVesting.releaseFor(ZERO)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(ZERO);
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(TEN);
    });
  });

  describe("releaseAllFor(address)", () => {
    it("not the owner", async () => {
      await expect(multiVesting.releaseAllFor(user, fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("nothing is due", async () => {
      await expect(multiVesting.releaseAllFor(user)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, TEN.muln(2))).to.be.fulfilled;

      await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;
      await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await advance.timeAndBlock(timeHelper.days(2));

      await expect(multiVesting.releaseAllFor(user)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");

      await advance.timeAndBlock(timeHelper.days(1));

      await expect(multiVesting.releaseAllFor(user)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(9).muln(2));
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(1).muln(2));

      await advance.timeAndBlock(timeHelper.days(4));

      await expect(multiVesting.releaseAllFor(user)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(5).muln(2));
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(5).muln(2));

      await advance.timeAndBlock(timeHelper.days(5));

      await expect(multiVesting.releaseAllFor(user)).to.be.fulfilled;
      await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(ZERO);
      await expect(crunch.balanceOf(user)).to.be.eventually.a.bignumber.equals(TEN.muln(2));
    });
  });

  describe("revoke(address, index)", () => {
    it("not the owner", async () => {
      await expect(multiVesting.revoke(ZERO, false, fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("not revocable", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(user, ONE, ONE, ONE, false)).to.be.fulfilled;

      await expect(multiVesting.revoke(ZERO, false)).to.be.rejectedWith(Error, "MultiVesting: token not revocable");
    });

    it("already revoked", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.revoke(ZERO, false)).to.be.fulfilled;

      await expect(multiVesting.revoke(ZERO, false)).to.be.rejectedWith(Error, "MultiVesting: token already revoked");
    });

    it("before cliff", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(user, ONE, ONE_YEAR, TWO_YEAR, true)).to.be.fulfilled;

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await expect(multiVesting.revoke(ZERO, false)).to.be.fulfilled;

      await advance.timeAndBlock(TWO_YEAR);

      await expect(multiVesting.release(ZERO, fromUser)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
    });

    it("ok", async () => {
      const half = TEN.divn(2);

      await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;

      await expect(multiVesting.vest(user, TEN, ONE_YEAR, TWO_YEAR, true)).to.be.fulfilled;

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      /* cliff */
      await advance.timeAndBlock(ONE_YEAR);
      await expect(multiVesting.releasableAmount(ZERO)).to.eventually.be.a.bignumber.equal(ZERO);

      /* 50% */
      await advance.timeAndBlock(ONE_YEAR);
      await expect(multiVesting.releasableAmount(ZERO)).to.eventually.be.a.bignumber.equal(half);

      await expect(multiVesting.revoke(ZERO, false)).to.be.fulfilled;

      await expect(multiVesting.totalSupply()).to.eventually.be.a.bignumber.equal(half);

      await advance.timeAndBlock(ONE_YEAR); /* will do nothing */

      await expect(multiVesting.release(ZERO, fromUser)).to.be.fulfilled;

      await expect(crunch.balanceOf(user)).to.eventually.be.a.bignumber.equal(half);

      await expect(multiVesting.totalSupply()).to.eventually.be.a.bignumber.equal(ZERO);
    });
  });

  describe("isBeneficiary(uint256, address)", () => {
    it("not existing", async () => {
      await expect(multiVesting.isBeneficiary(ZERO, owner)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.isBeneficiary(ZERO, owner)).to.be.eventually.false;
      await expect(multiVesting.isBeneficiary(ZERO, user)).to.be.eventually.true;
    });
  });

  describe("isVested(address)", () => {
    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, THREE)).to.be.fulfilled;

      await expect(multiVesting.isVested(owner)).to.be.eventually.false;
      await expect(multiVesting.isVested(user)).to.be.eventually.false;

      await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;
      await expect(multiVesting.isVested(owner)).to.be.eventually.false;
      await expect(multiVesting.isVested(user)).to.be.eventually.true;

      await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;
      await expect(multiVesting.isVested(owner)).to.be.eventually.false;
      await expect(multiVesting.isVested(user)).to.be.eventually.true;

      await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;
      await expect(multiVesting.isVested(owner)).to.be.eventually.true;
      await expect(multiVesting.isVested(user)).to.be.eventually.true;
    });
  });

  describe("releasableAmount(uint256)", () => {
    it("not existing", async () => {
      await expect(multiVesting.releasableAmount(ZERO)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });

    it("ok", async () => {
      const id = ZERO;

      await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;
      await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

      await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);

      await advance.timeAndBlock(timeHelper.months(1));

      await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);

      for (let index = 0; index < 2; ++index) {
        await advance.timeAndBlock(timeHelper.days(1));
        await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);
      }

      await advance.timeAndBlock(timeHelper.days(1));
      await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(ONE);

      await advance.timeAndBlock(timeHelper.days(4));
      await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(5));

      await expect(multiVesting.release(id, fromUser)).to.be.fulfilled;
      await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);

      await advance.timeAndBlock(timeHelper.days(4));
      await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(4));

      for (let index = 0; index < 2; ++index) {
        await advance.timeAndBlock(timeHelper.days(1));
        await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(5));
      }

      await expect(multiVesting.release(id, fromUser)).to.be.fulfilled;
      await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);

      await advance.timeAndBlock(timeHelper.days(1));
      await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);
    });

    describe("revoked", () => {
      it("before start", async () => {
        const id = ZERO;

        await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;
        await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

        await expect(multiVesting.revoke(id, false)).to.be.fulfilled;

        await expect(multiVesting.beginNow()).to.be.fulfilled;

        await advance.timeAndBlock(timeHelper.days(10));
        await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);
      });

      it("before cliff", async () => {
        const id = ZERO;

        await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;
        await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

        await expect(multiVesting.beginNow()).to.be.fulfilled;

        await advance.timeAndBlock(timeHelper.days(1));

        await expect(multiVesting.revoke(id, false)).to.be.fulfilled;

        await advance.timeAndBlock(timeHelper.days(10));
        await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);
      });

      it("mid", async () => {
        const id = ZERO;

        await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;
        await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

        await expect(multiVesting.beginNow()).to.be.fulfilled;

        await advance.timeAndBlock(timeHelper.days(2 + 5));

        await expect(multiVesting.revoke(id, false)).to.be.fulfilled;

        await advance.timeAndBlock(timeHelper.days(10));
        await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(5));

        await expect(multiVesting.release(id, fromUser)).to.be.fulfilled;
        await expect(multiVesting.releasableAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(ZERO));
      });
    });
  });

  describe("vestedAmount(uint256)", () => {
    it("not existing", async () => {
      await expect(multiVesting.vestedAmount(ZERO)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });

    it("ok", async () => {
      const id = ZERO;

      await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;
      await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

      await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);

      await advance.timeAndBlock(timeHelper.months(1));

      await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);

      for (let index = 0; index < 2; ++index) {
        await advance.timeAndBlock(timeHelper.days(1));
        await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);
      }

      await advance.timeAndBlock(timeHelper.days(1));
      await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(ONE);

      await advance.timeAndBlock(timeHelper.days(4));
      await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(5));

      await expect(multiVesting.release(id, fromUser)).to.be.fulfilled;
      await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(5));

      await advance.timeAndBlock(timeHelper.days(4));
      await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(9));

      for (let index = 0; index < 2; ++index) {
        await advance.timeAndBlock(timeHelper.days(1));
        await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(10));
      }

      await expect(multiVesting.release(id, fromUser)).to.be.fulfilled;
      await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(10));

      await advance.timeAndBlock(timeHelper.days(1));
      await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(10));
    });

    describe("revoked", () => {
      it("before start", async () => {
        const id = ZERO;

        await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;
        await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

        await expect(multiVesting.revoke(id, false)).to.be.fulfilled;

        await expect(multiVesting.beginNow()).to.be.fulfilled;

        await advance.timeAndBlock(timeHelper.days(10));
        await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);
      });

      it("before cliff", async () => {
        const id = ZERO;

        await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;
        await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

        await expect(multiVesting.beginNow()).to.be.fulfilled;

        await advance.timeAndBlock(timeHelper.days(1));

        await expect(multiVesting.revoke(id, false)).to.be.fulfilled;

        await advance.timeAndBlock(timeHelper.days(10));
        await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(ZERO);
      });

      it("mid", async () => {
        const id = ZERO;

        await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;
        await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

        await expect(multiVesting.beginNow()).to.be.fulfilled;

        await advance.timeAndBlock(timeHelper.days(2 + 5));

        await expect(multiVesting.revoke(id, false)).to.be.fulfilled;

        await advance.timeAndBlock(timeHelper.days(10));
        await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(5));

        await expect(multiVesting.release(id, fromUser)).to.be.fulfilled;
        await expect(multiVesting.vestedAmount(id)).to.be.eventually.be.a.bignumber.equals(new BN(5));
      });
    });
    describe("sendBack", () => {
      it("true", async () => {
        const id = ZERO;

        await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
        await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;

        await expect(multiVesting.revoke(id, true)).to.be.fulfilled;

        await expect(crunch.balanceOf(multiVesting.address)).to.be.eventually.be.a.bignumber.equals(ZERO);
        await expect(crunch.balanceOf(owner)).to.be.eventually.be.a.bignumber.equals(await crunch.totalSupply());
      });

      it("false", async () => {
        const id = ZERO;

        await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
        await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;

        await expect(multiVesting.revoke(id, false)).to.be.fulfilled;

        await expect(crunch.balanceOf(multiVesting.address)).to.be.eventually.be.a.bignumber.equals(ONE);
        await expect(crunch.balanceOf(owner)).to.be.eventually.be.a.bignumber.equals((await crunch.totalSupply()).sub(ONE));
      });
    });
  });

  it("ownedCount(address)", async () => {
    await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;

    await expect(multiVesting.ownedCount(user)).to.be.eventually.a.bignumber.equals(ZERO);

    await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;
    await expect(multiVesting.ownedCount(user)).to.be.eventually.a.bignumber.equals(ONE);

    await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;
    await expect(multiVesting.ownedCount(user)).to.be.eventually.a.bignumber.equals(TWO);

    await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;
    await expect(multiVesting.ownedCount(user)).to.be.eventually.a.bignumber.equals(THREE);

    await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;
    await expect(multiVesting.ownedCount(user)).to.be.eventually.a.bignumber.equals(THREE);
    await expect(multiVesting.ownedCount(owner)).to.be.eventually.a.bignumber.equals(ONE);

    await expect(multiVesting.transfer(owner, new BN(0), fromUser)).to.be.fulfilled;
    await expect(multiVesting.ownedCount(owner)).to.be.eventually.a.bignumber.equals(TWO);
    await expect(multiVesting.ownedCount(user)).to.be.eventually.a.bignumber.equals(TWO);

    await expect(multiVesting.transfer(owner, new BN(1), fromUser)).to.be.fulfilled;
    await expect(multiVesting.ownedCount(owner)).to.be.eventually.a.bignumber.equals(THREE);
    await expect(multiVesting.ownedCount(user)).to.be.eventually.a.bignumber.equals(ONE);

    await expect(multiVesting.transfer(owner, new BN(2), fromUser)).to.be.fulfilled;
    await expect(multiVesting.ownedCount(owner)).to.be.eventually.a.bignumber.equals(FOUR);
    await expect(multiVesting.ownedCount(user)).to.be.eventually.a.bignumber.equals(ZERO);
  });

  it("balanceOf(address)", async () => {
    await expect(crunch.transfer(multiVesting.address, new BN(30))).to.be.fulfilled;

    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(ZERO);

    await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(TEN);

    await expect(multiVesting.vest(user, TEN, timeHelper.days(4), timeHelper.days(10), true)).to.be.fulfilled;
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(20));

    await expect(multiVesting.vest(user, TEN, timeHelper.days(6), timeHelper.days(10), true)).to.be.fulfilled;
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(30));

    await expect(multiVesting.beginNow()).to.be.fulfilled;

    await advance.timeAndBlock(timeHelper.days(2 + 1));
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(10 + 10 + 10));

    await expect(multiVesting.releaseAll(fromUser)).to.be.fulfilled;
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(9 + 10 + 10));

    await advance.timeAndBlock(timeHelper.days(6));
    await expect(multiVesting.release(ZERO, fromUser)).to.be.fulfilled;
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(3 + 10 + 10));
    await expect(multiVesting.release(ONE, fromUser)).to.be.fulfilled;
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(3 + 5 + 10));

    await expect(multiVesting.revoke(ZERO, false)).to.be.fulfilled;
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(0 + 5 + 10));

    await advance.timeAndBlock(timeHelper.days(5));
    await expect(multiVesting.release(ONE, fromUser)).to.be.fulfilled;
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(0 + 0 + 10));
    await expect(multiVesting.release(TWO, fromUser)).to.be.fulfilled;
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(0 + 0 + 2));

    await advance.timeAndBlock(timeHelper.days(2));
    await expect(multiVesting.release(TWO, fromUser)).to.be.fulfilled;
    await expect(multiVesting.balanceOf(user)).to.be.eventually.a.bignumber.equals(new BN(0 + 0 + 0));
  });

  describe("balanceOfVesting(uint256)", () => {
    it("ok", async () => {
      const id = ZERO;

      await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;
      await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

      await expect(multiVesting.beginNow()).to.be.fulfilled;
      await expect(multiVesting.balanceOfVesting(id)).to.be.eventually.a.bignumber.equals(TEN);

      await advance.timeAndBlock(timeHelper.days(2 + 5));
      await expect(multiVesting.balanceOfVesting(id)).to.be.eventually.a.bignumber.equals(TEN);

      await expect(multiVesting.release(id, fromUser)).to.be.fulfilled;
      await expect(multiVesting.balanceOfVesting(id)).to.be.eventually.a.bignumber.equals(new BN(5));

      await advance.timeAndBlock(timeHelper.days(5));
      await expect(multiVesting.release(id, fromUser)).to.be.fulfilled;
      await expect(multiVesting.balanceOfVesting(id)).to.be.eventually.a.bignumber.equals(ZERO);
    });

    it("not existing", async () => {
      await expect(multiVesting.balanceOfVesting(ZERO)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });

    it("revoked", async () => {
      const id = ZERO;

      await expect(crunch.transfer(multiVesting.address, TEN)).to.be.fulfilled;
      await expect(multiVesting.vest(user, TEN, timeHelper.days(2), timeHelper.days(10), true)).to.be.fulfilled;

      await expect(multiVesting.beginNow()).to.be.fulfilled;
      await expect(multiVesting.balanceOfVesting(id)).to.be.eventually.a.bignumber.equals(TEN);

      await advance.timeAndBlock(timeHelper.days(2 + 5));
      await expect(multiVesting.balanceOfVesting(id)).to.be.eventually.a.bignumber.equals(TEN);

      await expect(multiVesting.revoke(id, false)).to.be.fulfilled;
      await expect(multiVesting.balanceOfVesting(id)).to.be.eventually.a.bignumber.equals(new BN(5));

      await expect(multiVesting.release(id, fromUser)).to.be.fulfilled;
      await expect(multiVesting.balanceOfVesting(id)).to.be.eventually.a.bignumber.equals(ZERO);

      await advance.timeAndBlock(timeHelper.days(5));
      await expect(multiVesting.balanceOfVesting(id)).to.be.eventually.a.bignumber.equals(ZERO);
    });
  });

  describe("emptyAvailableReserve()", () => {
    it("not the owner", async () => {
      await expect(multiVesting.emptyAvailableReserve(fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("no reserve", async () => {
      await expect(multiVesting.emptyAvailableReserve()).to.be.rejectedWith(Error, "MultiVesting: no token available");
    });

    it("no available reserve", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.emptyAvailableReserve()).to.be.rejectedWith(Error, "MultiVesting: no token available");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, TWO)).to.be.fulfilled;
      await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.emptyAvailableReserve()).to.be.fulfilled;

      await expect(crunch.balanceOf(multiVesting.address)).to.be.eventually.a.bignumber.equals(ONE);
      await expect(crunch.balanceOf(owner)).to.be.eventually.a.bignumber.equals((await crunch.totalSupply()).sub(ONE));
    });
  });

  function extractEvent(transaction, matcher) {
    return transaction.logs.filter(matcher);
  }

  describe("event Transfer", () => {
    it("on vest", async () => {
      const beneficiary = user;

      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      const transaction = await multiVesting.vest(beneficiary, ONE, ONE, ONE, true);
      const event = extractEvent(transaction, (log) => log.event == "Transfer")[0];

      expect(event.args.value).to.be.a.bignumber.equals(ONE);
      expect(event.args).to.include({
        from: NULL,
        to: beneficiary,
      });
    });

    it("on transfer", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      const transaction = await multiVesting.transfer(user, ZERO);
      const event = extractEvent(transaction, (log) => log.event == "Transfer")[0];

      expect(event.args.value).to.be.a.bignumber.equals(ONE);
      expect(event.args).to.include({
        from: owner,
        to: user,
      });
    });

    it("on revoke", async () => {
      const beneficiary = user;

      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vest(beneficiary, ONE, ONE, ONE, true)).to.be.fulfilled;

      const transaction = await multiVesting.revoke(ZERO, false);
      const event = extractEvent(transaction, (log) => log.event == "Transfer")[0];

      expect(event.args.value).to.be.a.bignumber.equals(ONE);
      expect(event.args).to.include({
        from: beneficiary,
        to: NULL,
      });
    });

    it("on release", async () => {
      const beneficiary = user;

      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vest(beneficiary, ONE, ONE, ONE, true)).to.be.fulfilled;
      await expect(multiVesting.beginAt(new BN(1))).to.be.fulfilled;

      const transaction = await multiVesting.release(ZERO, fromUser);
      const event = extractEvent(transaction, (log) => log.event == "Transfer")[1];

      expect(event.args.value).to.be.a.bignumber.equals(ONE);
      expect(event.args).to.include({
        from: beneficiary,
        to: NULL,
      });
    });
  });

  describe("event VestingBegin", () => {
    it("now", async () => {
      const transaction = await multiVesting.beginNow();
      const block = await blockHelper.get(transaction.receipt.blockNumber);
      const event = extractEvent(transaction, (log) => log.event == "VestingBegin")[0];

      expect(event.args.startDate).to.be.a.bignumber.equals(new BN(block.timestamp));
    });

    it("at", async () => {
      const transaction = await multiVesting.beginAt(ONE);
      const event = extractEvent(transaction, (log) => log.event == "VestingBegin")[0];

      expect(event.args.startDate).to.be.a.bignumber.equals(ONE);
    });
  });

  describe("event TokensReleased", () => {
    it("on release", async () => {
      const beneficiary = user;

      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vest(beneficiary, ONE, ONE, ONE, true)).to.be.fulfilled;
      await expect(multiVesting.beginAt(new BN(1))).to.be.fulfilled;

      const transaction = await multiVesting.release(ZERO, fromUser);
      const event = extractEvent(transaction, (log) => log.event == "TokensReleased")[0];

      expect(event.args.vestingId).to.be.a.bignumber.equals(ZERO);
      expect(event.args.amount).to.be.a.bignumber.equals(ONE);
      expect(event.args).to.include({
        beneficiary,
      });
    });

    it("on releaseFor", async () => {
      const beneficiary = user;

      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vest(beneficiary, ONE, ONE, ONE, true)).to.be.fulfilled;
      await expect(multiVesting.beginAt(new BN(1))).to.be.fulfilled;

      const transaction = await multiVesting.releaseFor(ZERO);
      const event = extractEvent(transaction, (log) => log.event == "TokensReleased")[0];

      expect(event.args.vestingId).to.be.a.bignumber.equals(ZERO);
      expect(event.args.amount).to.be.a.bignumber.equals(ONE);
      expect(event.args).to.include({
        beneficiary,
      });
    });

    it("on releaseAll", async () => {
      const beneficiary = user;

      await expect(crunch.transfer(multiVesting.address, THREE)).to.be.fulfilled;
      await expect(multiVesting.vestMultiple([beneficiary, beneficiary], [ONE, TWO], ONE, ONE, true)).to.be.fulfilled;
      await expect(multiVesting.beginAt(new BN(1))).to.be.fulfilled;

      const transaction = await multiVesting.releaseAll(fromUser);
      const events = extractEvent(transaction, (log) => log.event == "TokensReleased");

      expect(events.length).to.equals(2);

      expect(events[0].args.vestingId).to.be.a.bignumber.equals(ZERO);
      expect(events[0].args.amount).to.be.a.bignumber.equals(ONE);
      expect(events[0].args).to.include({
        beneficiary,
      });

      expect(events[1].args.vestingId).to.be.a.bignumber.equals(ONE);
      expect(events[1].args.amount).to.be.a.bignumber.equals(TWO);
      expect(events[1].args).to.include({
        beneficiary,
      });
    });

    it("on releaseAllFor", async () => {
      const beneficiary = user;

      await expect(crunch.transfer(multiVesting.address, THREE)).to.be.fulfilled;
      await expect(multiVesting.vestMultiple([beneficiary, beneficiary], [ONE, TWO], ONE, ONE, true)).to.be.fulfilled;
      await expect(multiVesting.beginAt(new BN(1))).to.be.fulfilled;

      const transaction = await multiVesting.releaseAllFor(beneficiary);
      const events = extractEvent(transaction, (log) => log.event == "TokensReleased");

      expect(events.length).to.equals(2);

      expect(events[0].args.vestingId).to.be.a.bignumber.equals(ZERO);
      expect(events[0].args.amount).to.be.a.bignumber.equals(ONE);
      expect(events[0].args).to.include({
        beneficiary,
      });

      expect(events[1].args.vestingId).to.be.a.bignumber.equals(ONE);
      expect(events[1].args.amount).to.be.a.bignumber.equals(TWO);
      expect(events[1].args).to.include({
        beneficiary,
      });
    });
  });
});
