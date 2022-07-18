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
const ONE_YEAR = new BN(timeHelper.years(1));
const TWO_YEAR = new BN(timeHelper.years(2));

const ONE_CRUNCH = new BN("1000000000000000000");

function expectVesting(got, expected) {
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
  });

  it("symbol()", async () => {
    await expect(multiVesting.symbol()).to.eventually.be.equal("mvCRUNCH.2");
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

    await expect(multiVesting.create(owner, half, timeHelper.years(1), timeHelper.years(1), true)).to.be.fulfilled;

    await expect(multiVesting.availableReserve()).to.eventually.be.a.bignumber.equal(half);
  });

  describe("begin()", () => {
    it("ok", async () => {
      const transaction = await expect(multiVesting.begin()).to.be.fulfilled;
      const { blockNumber } = transaction.receipt;
      const { timestamp } = await blockHelper.get(blockNumber);

      await expect(multiVesting.startDate()).to.eventually.a.bignumber.equal(new BN(timestamp));
    });

    it("only owner", async () => {
      await expect(multiVesting.begin(fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("cannot be called twice", async () => {
      await expect(multiVesting.begin()).to.be.fulfilled;
      await expect(multiVesting.begin()).to.be.rejectedWith(Error, "MultiVesting: already started");
    });
  });

  describe("create(address, uint256, uint256, uint256)", () => {
    it("beneficiary=0x0", async () => {
      await expect(multiVesting.create(NULL, ZERO, ZERO, ZERO, true)).to.be.rejectedWith(Error, "MultiVesting: beneficiary is the zero address");
    });

    it("already vesting", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.create(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.create(owner, ONE, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: beneficiary is already vested");
    });

    it("amount=0", async () => {
      await expect(multiVesting.create(owner, ZERO, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: amount is 0");
    });

    it("duration=0", async () => {
      await expect(multiVesting.create(owner, ONE, ONE, ZERO, true)).to.be.rejectedWith(Error, "MultiVesting: duration is 0");
    });

    it("cliff longer than duration", async () => {
      await expect(multiVesting.create(owner, ONE, TWO, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: cliff is longer than duration");
    });

    it("no reserve", async () => {
      await expect(multiVesting.create(owner, TWO, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: available reserve is not enough");

      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.create(owner, TWO, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: available reserve is not enough");

      await expect(multiVesting.create(owner, ONE, ONE, ONE, true)).to.be.fulfilled;
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.create(user, ONE, TWO, THREE, true)).to.be.fulfilled;

      await expect(multiVesting.isVested(user)).to.be.eventually.true;

      const vesting = await multiVesting.vestings(user);
      expectVesting(vesting, {
        beneficiary: user,
        amount: ONE,
        cliffDuration: TWO,
        duration: THREE,
        revocable: true,
        revoked: false,
        released: ZERO,
      });
    });
  });

  describe("transfer(address)", () => {
    it("not vesting", async () => {
      await expect(multiVesting.transfer(user)).to.be.rejectedWith(Error, "MultiVesting: not currently vesting");
    });

    it("already vesting", async () => {
      await expect(crunch.transfer(multiVesting.address, TWO)).to.be.fulfilled;

      await expect(multiVesting.create(owner, ONE, ONE, ONE, true)).to.be.fulfilled;
      await expect(multiVesting.create(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.transfer(user)).to.be.rejectedWith(Error, "MultiVesting: new beneficiary is already vested");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, TWO)).to.be.fulfilled;

      await expect(multiVesting.create(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.transfer(user)).to.be.fulfilled;

      await expect(multiVesting.isVested(owner)).to.be.eventually.false;
      await expect(multiVesting.isVested(user)).to.be.eventually.true;

      const vesting = await multiVesting.vestings(user);
      expectVesting(vesting, {
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

  describe("revoke(address, index)", () => {
    it("not revocable", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.create(user, ONE, ONE, ONE, false)).to.be.fulfilled;

      await expect(multiVesting.revoke(user)).to.be.rejectedWith(Error, "MultiVesting: token not revocable");
    });

    it("already revoked", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.create(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.revoke(user)).to.be.fulfilled;

      await expect(multiVesting.revoke(user)).to.be.rejectedWith(Error, "MultiVesting: token already revoked");
    });

    it("before cliff", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.create(user, ONE, ONE_YEAR, TWO_YEAR, true)).to.be.fulfilled;

      await expect(multiVesting.begin()).to.be.fulfilled;

      await expect(multiVesting.revoke(user)).to.be.fulfilled;

      await advance.timeAndBlock(TWO_YEAR);

      await expect(multiVesting.release(fromUser)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE_CRUNCH)).to.be.fulfilled;

      await expect(multiVesting.create(user, ONE_CRUNCH, ONE_YEAR, TWO_YEAR, true)).to.be.fulfilled;

      await expect(multiVesting.begin()).to.be.fulfilled;

      await advance.timeAndBlock(ONE_YEAR.add(ONE_YEAR.divn(2)));

      await expect(multiVesting.revoke(user)).to.be.fulfilled;

      await advance.timeAndBlock(ONE_YEAR);

      await expect(multiVesting.release(fromUser)).to.be.fulfilled;

      // TODO Check amount
      await expect(crunch.balanceOf(user)).to.eventually.be.a.bignumber.not.equal(ZERO);
    });
  });

  describe("clearFor()", () => {
    it("not the owner", async () => {
      await expect(multiVesting.clearFor(user, fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("no vesting", async () => {
      await expect(multiVesting.clear()).to.be.rejectedWith(Error, "MultiVesting: address is not vested");
    });

    it("not revoked", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.create(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.clearFor(user)).to.be.rejectedWith(Error, "MultiVesting: vesting not revoked");
    });

    it("still have token", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.create(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.begin()).to.be.fulfilled;
      await advance.timeAndBlock(TWO);

      await expect(multiVesting.revoke(user)).to.be.fulfilled;

      await expect(multiVesting.clearFor(user)).to.be.rejectedWith(Error, "MultiVesting: still have tokens");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.create(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.begin()).to.be.fulfilled;
      await advance.timeAndBlock(TWO);

      await expect(multiVesting.revoke(user)).to.be.fulfilled;
      await expect(multiVesting.release(fromUser)).to.be.fulfilled;

      await expect(multiVesting.clearFor(user)).to.be.fulfilled;

      await expect(multiVesting.isVested(user)).to.be.eventually.false;
    });
  });

  describe("clear()", () => {
    it("no vesting", async () => {
      await expect(multiVesting.clear()).to.be.rejectedWith(Error, "MultiVesting: address is not vested");
    });

    it("not revoked", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.create(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.clear()).to.be.rejectedWith(Error, "MultiVesting: vesting not revoked");
    });

    it("still have token", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.create(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.begin()).to.be.fulfilled;
      await advance.timeAndBlock(TWO);

      await expect(multiVesting.revoke(owner)).to.be.fulfilled;

      await expect(multiVesting.clear()).to.be.rejectedWith(Error, "MultiVesting: still have tokens");
    });

    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.create(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.begin()).to.be.fulfilled;
      await advance.timeAndBlock(TWO);

      await expect(multiVesting.revoke(owner)).to.be.fulfilled;
      await expect(multiVesting.release()).to.be.fulfilled;

      await expect(multiVesting.clear()).to.be.fulfilled;

      await expect(multiVesting.isVested(owner)).to.be.eventually.false;
    });
  });
});
