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
const TEN = new BN("10");
const ONE_YEAR = new BN(timeHelper.years(1));
const TWO_YEARS = new BN(timeHelper.years(2));
const THREE_YEARS = new BN(timeHelper.years(3));
const ONE_DAY = new BN(timeHelper.days(1));
const TWO_DAYS = new BN(timeHelper.days(2));
const THREE_DAYS = new BN(timeHelper.days(3));

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
    await expect(multiVesting.reserve()).to.eventually.be.a.bignumber.equal(
      ZERO
    );

    await expect(crunch.transfer(multiVesting.address, TWO_YEARS));

    await expect(multiVesting.reserve()).to.eventually.be.a.bignumber.equal(
      TWO_YEARS
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
});
