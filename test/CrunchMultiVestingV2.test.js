const advance = require("./helper/advance");
const blockHelper = require("./helper/block");
const timeHelper = require("./helper/time");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchMultiVestingV2 = artifacts.require("CrunchMultiVestingV2");

const NULL = "0x0000000000000000000000000000000000000000";
const ZERO = new BN("0");
const ONE = new BN("1");
const ONE_YEAR = new BN(timeHelper.years(1));
const TWO_YEAR = new BN(timeHelper.years(2));

const ONE_CRUNCH = new BN("1000000000000000000");

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
    await expect(multiVesting.startDate()).to.eventually.a.bignumber.equal(
      ZERO
    );
  });

  it("symbol()", async () => {
    await expect(multiVesting.symbol()).to.eventually.be.equal("mvCRUNCH.2");
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

  it("availableReserve()", async () => {
    const amount = new BN("10000");
    const half = amount.divn(2);

    await expect(
      multiVesting.availableReserve()
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(crunch.transfer(multiVesting.address, amount)).to.be.fulfilled;

    await expect(
      multiVesting.availableReserve()
    ).to.eventually.be.a.bignumber.equal(amount);

    await expect(
      multiVesting.create(
        owner,
        half,
        timeHelper.years(1),
        timeHelper.years(1),
        true
      )
    ).to.be.fulfilled;

    await expect(
      multiVesting.availableReserve()
    ).to.eventually.be.a.bignumber.equal(half);
  });

  it("begin()", async () => {
    const transaction = await expect(multiVesting.begin()).to.be.fulfilled;
    const { blockNumber } = transaction.receipt;
    const { timestamp } = await blockHelper.get(blockNumber);

    await expect(multiVesting.startDate()).to.eventually.a.bignumber.equal(
      new BN(timestamp)
    );
  });

  it("begin() : only owner", async () => {
    await expect(multiVesting.begin(fromUser)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );
  });

  it("begin() : cannot be called twice", async () => {
    await expect(multiVesting.begin()).to.be.fulfilled;
    await expect(multiVesting.begin()).to.be.rejectedWith(
      Error,
      "MultiVesting: already started"
    );
  });

  it("create(address, uint256, uint256, uint256) : beneficiary=0x0", async () => {
    await expect(
      multiVesting.create(NULL, ZERO, ZERO, ZERO, true)
    ).to.be.rejectedWith(
      Error,
      "MultiVesting: beneficiary is the zero address"
    );
  });

  it("revoke(address, index) : not revocable", async () => {
    await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

    await expect(multiVesting.create(user, ONE, ONE, ONE, false)).to.be
      .fulfilled;

    await expect(multiVesting.revoke(user, ZERO)).to.be.rejectedWith(
      Error,
      "MultiVesting: token not revocable"
    );
  });

  it("revoke(address, index) : already revoked", async () => {
    await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

    await expect(multiVesting.create(user, ONE, ONE, ONE, true)).to.be
      .fulfilled;

    await expect(multiVesting.revoke(user, ZERO)).to.be.fulfilled;

    await expect(multiVesting.revoke(user, ZERO)).to.be.rejectedWith(
      Error,
      "MultiVesting: token already revoked"
    );
  });

  it("revoke(address, index) : before cliff", async () => {
    await expect(crunch.transfer(multiVesting.address, ONE)).to.be.fulfilled;

    await expect(multiVesting.create(user, ONE, ONE_YEAR, TWO_YEAR, true)).to.be
      .fulfilled;

    await expect(multiVesting.begin()).to.be.fulfilled;

    await expect(multiVesting.revoke(user, ZERO)).to.be.fulfilled;

    await advance.timeAndBlock(TWO_YEAR);

    await expect(multiVesting.release(ZERO, fromUser)).to.be.rejectedWith(
      Error,
      "MultiVesting: no tokens are due"
    );
  });

  it("revoke(address, index)", async () => {
    await expect(crunch.transfer(multiVesting.address, ONE_CRUNCH)).to.be
      .fulfilled;

    await expect(
      multiVesting.create(user, ONE_CRUNCH, ONE_YEAR, TWO_YEAR, true)
    ).to.be.fulfilled;

    await expect(multiVesting.begin()).to.be.fulfilled;

    await advance.timeAndBlock(ONE_YEAR.add(ONE_YEAR.divn(2)));

    await expect(multiVesting.revoke(user, ZERO)).to.be.fulfilled;

    await advance.timeAndBlock(ONE_YEAR);

    await expect(multiVesting.release(ZERO, fromUser)).to.be.fulfilled;

    // TODO Check amount
    await expect(crunch.balanceOf(user)).to.eventually.be.a.bignumber.not.equal(ZERO);
  });
});
