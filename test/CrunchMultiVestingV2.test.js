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
      await expect(multiVesting.vest(NULL, ZERO, ZERO, ZERO, true)).to.be.rejectedWith(Error, "MultiVesting: beneficiary is the zero address");
    });

    it("amount=0", async () => {
      await expect(multiVesting.vest(owner, ZERO, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: amount is 0");
    });

    it("duration=0", async () => {
      await expect(multiVesting.vest(owner, ONE, ONE, ZERO, true)).to.be.rejectedWith(Error, "MultiVesting: duration is 0");
    });

    it("cliff longer than duration", async () => {
      await expect(multiVesting.vest(owner, ONE, TWO, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: cliff is longer than duration");
    });

    it("no reserve", async () => {
      await expect(multiVesting.vest(owner, TWO, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: available reserve is not enough");

      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(owner, TWO, ONE, ONE, true)).to.be.rejectedWith(Error, "MultiVesting: available reserve is not enough");

      await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;
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

  describe("transfer(address)", () => {
    it("unknown vesting", async () => {
      await expect(multiVesting.transfer(user, ZERO)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });

    it("not the owner", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(owner, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.transfer(user, ZERO, fromUser)).to.be.rejectedWith(Error, "MultiVesting: not the beneficiary");
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

  describe("release()", () => {
    it("not existing", async () => {
      await expect(multiVesting.release(ZERO, fromUser)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });
  });

  describe("releaseAll()", () => {
    it("nothing is due", async () => {
      await expect(multiVesting.releaseAll(fromUser)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
    });
  });

  describe("releaseFor(address)", () => {
    it("not the owner", async () => {
      await expect(multiVesting.releaseFor(ZERO, fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("not existing", async () => {
      await expect(multiVesting.releaseFor(ZERO)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });
  });

  describe("releaseAllFor()", () => {
    it("not the owner", async () => {
      await expect(multiVesting.releaseAllFor(user, fromUser)).to.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("nothing is due", async () => {
      await expect(multiVesting.releaseAllFor(user)).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
    });
  });

  describe("revoke(address, index)", () => {
    it("not revocable", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(user, ONE, ONE, ONE, false)).to.be.fulfilled;

      await expect(multiVesting.revoke(ZERO)).to.be.rejectedWith(Error, "MultiVesting: token not revocable");
    });

    it("already revoked", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.revoke(ZERO)).to.be.fulfilled;

      await expect(multiVesting.revoke(ZERO)).to.be.rejectedWith(Error, "MultiVesting: token already revoked");
    });

    it("before cliff", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

      await expect(multiVesting.vest(user, ONE, ONE_YEAR, TWO_YEAR, true)).to.be.fulfilled;

      await expect(multiVesting.beginNow()).to.be.fulfilled;

      await expect(multiVesting.revoke(ZERO)).to.be.fulfilled;

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

      await expect(multiVesting.revoke(ZERO)).to.be.fulfilled;

      await advance.timeAndBlock(ONE_YEAR); /* will do nothing */

      await expect(multiVesting.release(ZERO, fromUser)).to.be.fulfilled;

      await expect(crunch.balanceOf(user)).to.eventually.be.a.bignumber.equal(half);
    });
  });

  describe("isBeneficiary(uint256, address)", () => {
    it("not existing", async () => {
      await expect(multiVesting.isBeneficiary(ZERO, owner)).to.be.rejectedWith(Error, "MultiVesting: vesting does not exists");
    });
    
    it("ok", async () => {
      await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;
      await expect(multiVesting.vest(user, ONE, ONE, ONE, true)).to.be.fulfilled;

      await expect(multiVesting.isBeneficiary(ZERO, owner)).to.be.eventually.false
      await expect(multiVesting.isBeneficiary(ZERO, user)).to.be.eventually.true
    });
  });
});
