const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchSelling = artifacts.require("CrunchSelling");
const USDCoin = artifacts.require("USDCoin");

const nulled = "0x0000000000000000000000000000000000000000";
const dummy = "0x4242424242424242424242424242424242424242";

const FORTY_ONE = new BN(web3.utils.toWei("41"));
const FORTY_TWO = new BN(web3.utils.toWei("42"));

contract("Crunch Vesting", async ([owner, user, ...accounts]) => {
  const fromUser = { from: user };

  let usdc;
  let crunch;
  let selling;

  const initialPrice = new BN(1_000_000 / 4); /* 4 USD */

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    usdc = await USDCoin.new();

    /* using the crunch as a fake usdc */
    selling = await CrunchSelling.new(
      crunch.address,
      usdc.address,
      initialPrice
    );
  });

  it("initial state", async () => {
    await expect(selling.owner()).to.eventually.be.equal(owner);
    await expect(selling.crunch()).to.eventually.be.equal(crunch.address);
    await expect(selling.usdc()).to.eventually.be.equal(usdc.address);
    await expect(selling.price()).to.eventually.be.a.bignumber.equal(
      initialPrice
    );
    await expect(selling.paused()).to.eventually.be.false;
  });

  it("sell(uint256) : amount=0", async () => {
    await expect(selling.sell(0)).to.be.rejected;
  });

  it("estimate(uint256)", async () => {
    await expect(selling.estimate(0)).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );

    const test = async (priceInUsd, amount, expectedOutput) => {
      let price = new BN(1000000 / priceInUsd);

      const current = await selling.price();
      if (!current.eq(price)) {
        await expect(selling.setPrice(price)).to.be.fulfilled;
      }

      await expect(
        selling.estimate(web3.utils.toWei(`${amount}`))
      ).to.eventually.be.a.bignumber.equal(
        new BN(web3.utils.toWei(`${expectedOutput}`))
      );
    };

    await test(1, 1, 1);
    await test(1, 100, 100);

    await test(4, 1, 4);
    await test(4, 100, 400);

    await test(12.8, 1, 12.8);
    await test(12.8, 100, 1280);

    await test(2.5, 42, 105);
  });

  it("reserve()", async () => {
    const amount = new BN(1000);

    await expect(selling.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );

    await expect(usdc.mint(selling.address, amount)).to.be.fulfilled;

    await expect(selling.reserve()).to.eventually.be.a.bignumber.equal(amount);
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
    /* not the owner */
    await expect(selling.setUsdc(dummy, { from: accounts[0] })).to.be.rejected;

    /* null address */
    await expect(selling.setUsdc(nulled)).to.be.rejected;

    /* same address */
    await expect(selling.setUsdc(usdc.address)).to.be.rejected;

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
