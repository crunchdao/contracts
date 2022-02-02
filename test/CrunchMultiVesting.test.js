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

contract("Crunch Multi Vesting", async ([owner, user, ...accounts]) => {
  const fromUser = { from: user };

  let crunch;
  let multiVesting;

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    multiVesting = await CrunchMultiVesting.new(crunch.address);
  });

  it("initial state", async () => {
    await expect(multiVesting.owner()).to.eventually.be.equal(owner);
    await expect(multiVesting.creator()).to.eventually.be.equal(owner);
  });

  it("name()", async () => {
    await expect(multiVesting.name()).to.eventually.be.equal(
      "Vested CRUNCH Token"
    );
  });

  it("symbol()", async () => {
    await expect(multiVesting.symbol()).to.eventually.be.equal("vCRUNCH");
  });

  it("decimals()", async () => {
    await expect(multiVesting.decimals()).to.eventually.be.a.bignumber.equal(
      await crunch.decimals()
    );
  });

  it("reserve()", async () => {
    const amount = new BN("10000");

    await expect(multiVesting.reserve()).to.eventually.be.a.bignumber.equal(
      ZERO
    );

    await expect(crunch.transfer(multiVesting.address, amount)).to.be.fulfilled;

    await expect(multiVesting.reserve()).to.eventually.be.a.bignumber.equal(
      amount
    );
  });

  it("create(address, uint256, uint256, uint256) : beneficiary=0x0", async () => {
    await expect(
      multiVesting.create(NULL, ZERO, ZERO, ZERO)
    ).to.be.rejectedWith(
      Error,
      "MultiVesting: beneficiary is the zero address"
    );
  });

  it("create(address, uint256, uint256, uint256) : amount=0", async () => {
    await expect(
      multiVesting.create(user, ZERO, ZERO, ZERO)
    ).to.be.rejectedWith(Error, "MultiVesting: amount is 0");
  });

  it("create(address, uint256, uint256, uint256) : duration=0", async () => {
    await expect(multiVesting.create(user, ONE, ZERO, ZERO)).to.be.rejectedWith(
      Error,
      "MultiVesting: duration is 0"
    );
  });

  it("create(address, uint256, uint256, uint256) : cliff>duration", async () => {
    await expect(
      multiVesting.create(user, ONE, TWO_YEARS, ONE_YEAR)
    ).to.be.rejectedWith(Error, "MultiVesting: cliff is longer than duration");
  });

  it("create(address, uint256, uint256, uint256) : from a user", async () => {
    await expect(
      multiVesting.create(user, ONE, ONE_YEAR, TWO_YEARS, fromUser)
    ).to.be.rejectedWith(
      Error,
      "MultiVesting: only creator or owner can do this"
    );
  });

  it("create(address, uint256, uint256, uint256)", async () => {
    const beneficiary = user;

    const create = async (amount, cliffDuration, duration, index) => {
      await expect(
        multiVesting.create(beneficiary, amount, cliffDuration, duration)
      ).to.be.fulfilled;

      let block = await blockHelper.latest();
      let start = new BN(block.timestamp);

      await expect(
        multiVesting.vestingsCount(beneficiary)
      ).to.eventually.be.a.bignumber.equal(amount);

      await expect(multiVesting.vestings(beneficiary, index))
        .to.eventually.have.property("beneficiary")
        .and.equal(beneficiary);

      await expect(multiVesting.vestings(beneficiary, index))
        .to.eventually.have.property("amount")
        .and.be.a.bignumber.equal(amount);

      await expect(multiVesting.vestings(beneficiary, index))
        .to.eventually.have.property("start")
        .and.be.a.bignumber.equal(start);

      await expect(multiVesting.vestings(beneficiary, index))
        .to.eventually.have.property("cliff")
        .and.be.a.bignumber.equal(start.add(cliffDuration));

      await expect(multiVesting.vestings(beneficiary, index))
        .to.eventually.have.property("duration")
        .and.be.a.bignumber.equal(duration);

      await expect(multiVesting.vestings(beneficiary, index))
        .to.eventually.have.property("released")
        .and.be.a.bignumber.equal(ZERO);
    };

    await create(ONE, ONE_YEAR, THREE_YEARS, 0);
    await create(TWO, THREE_YEARS, THREE_YEARS, 1);
  });

  it("release(uint256) : x1", async () => {
    const beneficiary = user;
    const amount = new BN("100");
    const cliffDuration = TWO_DAYS;
    const duration = TEN_DAYS;

    const fromBeneficiary = {
      from: beneficiary,
    };

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    /* invalid index */
    await expect(multiVesting.release(new BN("10"), fromBeneficiary)).to.be
      .rejected;

    const index = new BN("0");

    await expect(
      multiVesting.release(index, fromBeneficiary)
    ).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.release(index, fromBeneficiary)
    ).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("20"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await advance.timeAndBlock(timeHelper.days(2));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("50"));

    await advance.timeAndBlock(timeHelper.days(5));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(amount);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.release(index, fromBeneficiary)
    ).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
  });

  it("release(uint256) : x2", async () => {
    const beneficiary = user;
    const amount = new BN("100");
    const cliffDuration = TWO_DAYS;
    const duration = TEN_DAYS;

    const fromBeneficiary = {
      from: beneficiary,
    };

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    const index = new BN("0");
    const index2 = new BN("1");

    await expect(
      multiVesting.release(index, fromBeneficiary)
    ).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");

    await advance.timeAndBlock(timeHelper.days(5));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("50"));

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    await expect(
      multiVesting.release(index2, fromBeneficiary)
    ).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");

    await advance.timeAndBlock(timeHelper.days(3));

    await expect(multiVesting.release(index2, fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("50").add(new BN("30")));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("80").add(new BN("30")));

    await advance.timeAndBlock(timeHelper.days(7));

    await expect(multiVesting.release(index2, fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("80").add(new BN("100")));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("100")));

    await expect(
      multiVesting.release(index2, fromBeneficiary)
    ).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
    await expect(
      multiVesting.release(index, fromBeneficiary)
    ).to.be.rejectedWith(Error, "MultiVesting: no tokens are due");
  });

  it("releaseAll() : x1", async () => {
    const beneficiary = user;
    const amount = new BN("100");
    const cliffDuration = TWO_DAYS;
    const duration = TEN_DAYS;

    const fromBeneficiary = {
      from: beneficiary,
    };

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.rejectedWith(
      Error,
      "MultiVesting: no tokens are due"
    );

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.rejectedWith(
      Error,
      "MultiVesting: no tokens are due"
    );

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("20"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await advance.timeAndBlock(timeHelper.days(2));

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("50"));

    await advance.timeAndBlock(timeHelper.days(5));

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(amount);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.rejectedWith(
      Error,
      "MultiVesting: no tokens are due"
    );
  });

  it("releaseAll() : x2", async () => {
    const beneficiary = user;
    const amount = new BN("100");
    const cliffDuration = TWO_DAYS;
    const duration = TEN_DAYS;

    const fromBeneficiary = {
      from: beneficiary,
    };

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.rejectedWith(
      Error,
      "MultiVesting: no tokens are due"
    );

    await advance.timeAndBlock(timeHelper.days(5));

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("50"));

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ONE);

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(TWO);

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.rejectedWith(
      Error,
      "MultiVesting: no tokens are due"
    );

    await advance.timeAndBlock(timeHelper.days(3));

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("80").add(new BN("30")));

    await advance.timeAndBlock(timeHelper.days(2));

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("50")));

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ONE);

    await advance.timeAndBlock(timeHelper.days(5));

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("100")));

    await expect(multiVesting.releaseAll(fromBeneficiary)).to.be.rejectedWith(
      Error,
      "MultiVesting: no tokens are due"
    );

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);
  });

  it("releasableAmount(address)", async () => {
    const beneficiary = user;
    const amount = new BN("100");
    const cliffDuration = TWO_DAYS;
    const duration = TEN_DAYS;

    const fromBeneficiary = {
      from: beneficiary,
    };

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("20"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("30").add(ZERO));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("40").add(ZERO));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("50").add(new BN("20")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("60").add(new BN("30")));

    const index = new BN("0");
    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("0").add(new BN("30")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("10").add(new BN("40")));

    const index2 = new BN("1");
    await expect(multiVesting.release(index2, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("10").add(new BN("0")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("20").add(new BN("10")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("30").add(new BN("20")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("40").add(new BN("30")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("40").add(new BN("40")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("40").add(new BN("50")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("40").add(new BN("60")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("40").add(new BN("60")));

    await expect(multiVesting.release(index2, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("40").add(new BN("0")));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("0").add(new BN("0")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("0").add(new BN("0")));
  });

  it("releasableAmountAt(address, uint256)", async () => {
    const beneficiary = user;
    const amount = new BN("100");
    const cliffDuration = TWO_DAYS;
    const duration = TEN_DAYS;

    const fromBeneficiary = {
      from: beneficiary,
    };

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    const index = new BN("0");
    const index2 = new BN("1");

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("20"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("0"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("50"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("20"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("60"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("0"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("10"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await expect(multiVesting.release(index2, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("10"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("0"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("20"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("10"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("20"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("50"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("60"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("60"));

    await expect(multiVesting.release(index2, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("0"));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("0"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("0"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("0"));

    await expect(
      multiVesting.releasableAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("0"));
  });

  it("vestedAmount(address)", async () => {
    const beneficiary = user;
    const amount = new BN("100");
    const cliffDuration = TWO_DAYS;
    const duration = TEN_DAYS;

    const fromBeneficiary = {
      from: beneficiary,
    };

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("20"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("30").add(ZERO));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("40").add(ZERO));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("50").add(new BN("20")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("60").add(new BN("30")));

    const index = new BN("0");
    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("60").add(new BN("30")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("70").add(new BN("40")));

    const index2 = new BN("1");
    await expect(multiVesting.release(index2, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("70").add(new BN("40")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("80").add(new BN("50")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("90").add(new BN("60")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("70")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("80")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("90")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("100")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("100")));

    await expect(multiVesting.release(index2, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("100")));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("100")));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN("100").add(new BN("100")));
  });

  it("vestedAmountAt(address, uint256)", async () => {
    const beneficiary = user;
    const amount = new BN("100");
    const cliffDuration = TWO_DAYS;
    const duration = TEN_DAYS;

    const fromBeneficiary = {
      from: beneficiary,
    };

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    const index = new BN("0");
    const index2 = new BN("1");

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("20"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await expect(
      multiVesting.create(beneficiary, amount, cliffDuration, duration)
    ).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("30").add(ZERO));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("0"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("50"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("20"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("60"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("60"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("30"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("70"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await expect(multiVesting.release(index2, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("70"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("40"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("80"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("50"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("90"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("60"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("70"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("80"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("90"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await expect(multiVesting.release(index2, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await expect(multiVesting.release(index, fromBeneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));

    await expect(
      multiVesting.vestedAmountAt(beneficiary, index2)
    ).to.eventually.be.a.bignumber.equal(new BN("100"));
  });

  it("setCrunch(address)", async () => {
    const dummy = (await CrunchToken.new()).address;

    await expect(multiVesting.setCrunch(dummy, fromUser)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(multiVesting.setCrunch(dummy)).to.be.fulfilled;

    await expect(multiVesting.crunch()).to.eventually.equal(dummy);
  });

  it("setCreator(address)", async () => {
    const dummy = user;

    await expect(multiVesting.setCreator(dummy, fromUser)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(multiVesting.setCreator(dummy)).to.be.fulfilled;

    await expect(multiVesting.creator()).to.eventually.equal(dummy);
  });

  it("vestingsCount(address)", async () => {
    const beneficiary = user;

    await expect(
      multiVesting.vestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(multiVesting.create(beneficiary, ONE, ONE_YEAR, THREE_YEARS))
      .to.be.fulfilled;

    await expect(
      multiVesting.vestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ONE);

    await expect(multiVesting.create(beneficiary, ONE, ONE_YEAR, THREE_YEARS))
      .to.be.fulfilled;

    await expect(
      multiVesting.vestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(TWO);
  });

  it("balanceOf(address) : x1", async () => {
    const beneficiary = user;

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(multiVesting.create(beneficiary, TEN, TWO_DAYS, TEN_DAYS)).to
      .be.fulfilled;

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(2));

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(TWO);

    await advance.timeAndBlock(timeHelper.days(8));

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(TEN);

    await advance.timeAndBlock(timeHelper.days(1));

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(TEN);

    await expect(multiVesting.releaseAllFor(beneficiary)).to.eventually.be
      .fulfilled;

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);
  });

  it("balanceOf(address) : x3", async () => {
    const beneficiary = user;

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(multiVesting.create(beneficiary, TEN, TWO_DAYS, TEN_DAYS)).to
      .be.fulfilled;

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(2));

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(TWO);

    await expect(multiVesting.create(beneficiary, TEN, TWO_DAYS, TEN_DAYS)).to
      .be.fulfilled;

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(TWO);

    await advance.timeAndBlock(timeHelper.days(2));

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(FOUR.add(TWO));

    await expect(multiVesting.create(beneficiary, TEN, TWO_DAYS, TEN_DAYS)).to
      .be.fulfilled;

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(FOUR.add(TWO));

    await advance.timeAndBlock(timeHelper.days(2));

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(SIX.add(FOUR).add(TWO));

    await advance.timeAndBlock(timeHelper.days(4));

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(TEN.add(EIGHT).add(SIX));

    await expect(multiVesting.releaseAllFor(beneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await advance.timeAndBlock(timeHelper.days(10));

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(TWO.add(FOUR));

    await expect(multiVesting.releaseAllFor(beneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);
  });

  it("activeVestingsCount(address)", async () => {
    const beneficiary = user;

    await expect(
      crunch.transfer(multiVesting.address, await crunch.totalSupply())
    ).to.be.fulfilled;

    await expect(multiVesting.create(beneficiary, TEN, ONE_DAY, TWO_DAYS)).to.be
      .fulfilled;

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ONE);

    await advance.timeAndBlock(timeHelper.oneYear);

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ONE);

    await expect(multiVesting.create(beneficiary, TWENTY, ONE_DAY, TWO_DAYS)).to
      .be.fulfilled;

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(TWO);

    await expect(multiVesting.releaseAllFor(beneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ONE);

    await advance.timeAndBlock(timeHelper.oneYear);

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ONE);

    await expect(multiVesting.releaseAllFor(beneficiary)).to.be.fulfilled;

    await expect(
      multiVesting.activeVestingsCount(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);
  });
});
