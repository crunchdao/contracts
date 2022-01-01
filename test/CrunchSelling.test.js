const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchSelling = artifacts.require("CrunchSelling");

contract("Crunch Vesting", async ([owner, ...accounts]) => {
  let crunch;
  let selling;

  const initialAmount = new BN(10000);
  const initialPrice = new BN(100);

  beforeEach(async () => {
    crunch = await CrunchToken.new();

    /* using the crunch as a fake usdc */
    selling = await CrunchSelling.new(
      crunch.address,
      crunch.address,
      initialPrice
    );

    await crunch.transfer(selling.address, initialAmount);
  });

  it("initial state", async () => {
    await expect(selling.owner()).to.eventually.be.equal(owner);
    await expect(selling.crunch()).to.eventually.be.equal(crunch.address);
    await expect(selling.usdc()).to.eventually.be.equal(crunch.address);
    await expect(selling.price()).to.eventually.be.a.bignumber.equal(
      initialPrice
    );
    await expect(selling.paused()).to.eventually.be.false;
  });

  it("reserve()", async () => {
    const amount = new BN(1000);

    await expect(selling.reserve()).to.eventually.be.a.bignumber.equal(
      initialAmount
    );

    await expect(crunch.transfer(selling.address, amount)).to.be.fulfilled;

    await expect(selling.reserve()).to.eventually.be.a.bignumber.equal(
      initialAmount.add(amount)
    );
  });

  it("pause()", async () => {
    await expect(selling.pause({ from: accounts[0] })).to.be.rejected;

    await expect(selling.pause()).to.be.fulfilled;

    await expect(selling.paused()).to.eventually.be.true;

    await expect(selling.pause()).to.be.rejected;
  });

  it("unpause()", async () => {
    await expect(selling.pause()).to.be.fulfilled;

    await expect(selling.unpause({ from: accounts[0] })).to.be.rejected;

    await expect(selling.unpause()).to.be.fulfilled;

    await expect(selling.paused()).to.eventually.be.false;
  });

  it("setCrunch(address)", async () => {
    const nulled = "0x0000000000000000000000000000000000000000";
    const dummy = "0x4242424242424242424242424242424242424242";

    /* not the owner */
    await expect(selling.setCrunch(dummy, { from: accounts[0] })).to.be
      .rejected;

    /* null address */
    await expect(selling.setCrunch(nulled)).to.be.rejected;

    /* same address */
    await expect(selling.setCrunch(crunch.address)).to.be.rejected;

    await expect(selling.setCrunch(dummy)).to.be.fulfilled;

    await expect(selling.crunch()).to.eventually.be.equal(dummy);
  });

  it("setUsdc(address)", async () => {
    const nulled = "0x0000000000000000000000000000000000000000";
    const dummy = "0x4242424242424242424242424242424242424242";

    /* not the owner */
    await expect(selling.setUsdc(dummy, { from: accounts[0] })).to.be.rejected;

    /* null address */
    await expect(selling.setUsdc(nulled)).to.be.rejected;

    /* same address */
    await expect(selling.setUsdc(crunch.address)).to.be.rejected;

    await expect(selling.setUsdc(dummy)).to.be.fulfilled;

    await expect(selling.usdc()).to.eventually.be.equal(dummy);
  });

  it("setPrice(uint256)", async () => {
    const newPrice = new BN(42);

    /* not the owner */
    await expect(selling.setPrice(newPrice, { from: accounts[0] })).to.be
      .rejected;

    /* same price */
    await expect(selling.setPrice(initialPrice)).to.be.rejected;

    await expect(selling.setPrice(newPrice)).to.be.fulfilled;

    await expect(selling.price()).to.eventually.be.a.bignumber.equal(newPrice);
  });
});
