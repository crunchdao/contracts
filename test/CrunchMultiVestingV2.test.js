const advance = require("./helper/advance");
const blockHelper = require("./helper/block");
const timeHelper = require("./helper/time");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchMultiVestingV2 = artifacts.require("CrunchMultiVestingV2");

const NULL = "0x0000000000000000000000000000000000000000";
const ZERO = new BN("0");

contract("Crunch Multi Vesting", async ([owner, user, ...accounts]) => {
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

  it("create(address, uint256, uint256, uint256) : beneficiary=0x0", async () => {
    await expect(
      multiVesting.create(NULL, ZERO, ZERO, ZERO)
    ).to.be.rejectedWith(
      Error,
      "MultiVesting: beneficiary is the zero address"
    );
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
});
