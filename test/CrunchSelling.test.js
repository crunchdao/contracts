const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchSelling = artifacts.require("CrunchSelling");
const USDCoin = artifacts.require("USDCoin");

const FORTY_ONE = new BN(web3.utils.toWei("41"));
const FORTY_TWO = new BN(web3.utils.toWei("42"));
const ZERO = new BN("0");

contract("Crunch Selling", async ([owner, user, ...accounts]) => {
  const fromUser = { from: user };

  let usdc;
  let crunch;
  let selling;

  const initialPriceInteger = new BN("4");
  const initialPrice = new BN(web3.utils.toWei(initialPriceInteger));

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    usdc = await USDCoin.new();

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
    await expect(selling.oneCrunch()).to.eventually.be.a.bignumber.equal(
      new BN(web3.utils.toWei("1"))
    );
  });

  it("sell(uint256) : amount=0", async () => {
    await expect(selling.sell(0, fromUser)).to.be.rejectedWith(
      Error,
      "Selling: cannot sell 0 unit"
    );
  });

  it("sell(uint256) : allowance too small", async () => {
    await expect(crunch.approve(selling.address, FORTY_ONE, fromUser)).to.be
      .fulfilled;

    await expect(selling.sell(FORTY_TWO, fromUser)).to.be.rejectedWith(
      Error,
      "Selling: user's allowance is not enough"
    );
  });

  it("sell(uint256) : balance too small", async () => {
    await expect(crunch.approve(selling.address, FORTY_TWO, fromUser)).to.be
      .fulfilled;

    await expect(crunch.transfer(user, FORTY_ONE)).to.be.fulfilled;

    await expect(selling.sell(FORTY_TWO, fromUser)).to.be.rejectedWith(
      Error,
      "Selling: user's balance is not enough"
    );
  });

  it("sell(uint256) : no enough reserve", async () => {
    await expect(crunch.approve(selling.address, FORTY_TWO, fromUser)).to.be
      .fulfilled;

    await expect(crunch.transfer(user, FORTY_TWO)).to.be.fulfilled;

    await expect(usdc.mint(selling.address, FORTY_ONE)).to.be.fulfilled;

    await expect(selling.sell(FORTY_TWO, fromUser)).to.be.rejectedWith(
      Error,
      "Selling: reserve is not big enough"
    );
  });

  it("sell(uint256) : cannot when paused", async () => {
    const expectedOutput = FORTY_TWO.mul(new BN(4));

    await expect(crunch.transfer(user, FORTY_TWO)).to.be.fulfilled;

    await expect(crunch.approve(selling.address, FORTY_TWO, fromUser)).to.be
      .fulfilled;

    await expect(usdc.mint(selling.address, expectedOutput)).to.be.fulfilled;

    await expect(selling.pause()).to.be.fulfilled;
    await expect(selling.sell(FORTY_TWO, fromUser)).to.be.rejected;

    await expect(selling.unpause()).to.be.fulfilled;
    await expect(selling.sell(FORTY_TWO, fromUser)).to.be.fulfilled;
  });

  it("sell(uint256) : owner cannot sell", async () => {
    const expectedOutput = FORTY_TWO.mul(new BN(4));

    await expect(crunch.transfer(user, FORTY_TWO)).to.be.fulfilled;

    await expect(crunch.approve(selling.address, FORTY_TWO)).to.be.fulfilled;

    await expect(usdc.mint(selling.address, expectedOutput)).to.be.fulfilled;

    await expect(selling.sell(FORTY_TWO)).to.be.rejectedWith(
      Error,
      "Selling: owner cannot sell"
    );
  });

  it("sell(uint256)", async () => {
    const expectedOutput = FORTY_TWO.mul(initialPriceInteger);

    await expect(crunch.transfer(user, FORTY_TWO)).to.be.fulfilled;

    await expect(crunch.approve(selling.address, FORTY_TWO, fromUser)).to.be
      .fulfilled;

    await expect(usdc.mint(selling.address, expectedOutput)).to.be.fulfilled;

    await expect(selling.sell(FORTY_TWO, fromUser)).to.be.fulfilled;

    await expect(
      usdc.balanceOf(selling.address)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(usdc.balanceOf(user)).to.eventually.be.a.bignumber.equal(
      expectedOutput
    );

    await expect(crunch.balanceOf(user)).to.eventually.be.a.bignumber.equal(
      ZERO
    );

    await expect(crunch.balanceOf(owner)).to.eventually.be.a.bignumber.equal(
      await crunch.totalSupply()
    );
  });

  it("onTokenTransfer(address, uint256, bytes) : not from crunch", async () => {
    await expect(
      selling.onTokenTransfer(owner, FORTY_TWO, [])
    ).to.be.rejectedWith(Error, "Selling: caller must be the crunch token");
  });

  it("conversion(uint256)", async () => {
    await expect(selling.conversion(0)).to.eventually.be.a.bignumber.equal(
      ZERO
    );

    const test = async (priceInUsd, amount, expectedOutput) => {
      let price = new BN(web3.utils.toWei(`${priceInUsd}`));

      const current = await selling.price();
      if (!current.eq(price)) {
        await expect(selling.setPrice(price)).to.be.fulfilled;
      }

      await expect(
        selling.conversion(web3.utils.toWei(`${amount}`))
      ).to.eventually.be.a.bignumber.equal(
        new BN(web3.utils.toWei(`${expectedOutput}`))
      );
    };

    await test(1, 0, 0);

    await test(1, 1, 1);
    await test(1, 100, 100);

    await test(2.4, 1, 2.4);
    await test(2.4, 100, 240);

    await test(2.5, 42, 105);
    await test(2.5, 9999, 24997.5);

    await test(4, 1, 4);
    await test(4, 100, 400);

    await test(12.8, 1, 12.8);
    await test(12.8, 100, 1280);
    await test(12.8, 1.006, 12.8768);

    await test(123456.789, 99.99, 12344444.33211);
  });

  it("reserve()", async () => {
    const amount = new BN(1000);

    await expect(selling.reserve()).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(usdc.mint(selling.address, amount)).to.be.fulfilled;

    await expect(selling.reserve()).to.eventually.be.a.bignumber.equal(amount);
  });

  it("emptyReserve()", async () => {
    const amount = new BN(1000);

    await expect(selling.emptyReserve()).to.be.rejectedWith(
      Error,
      "Selling: reserve already empty"
    );

    await expect(usdc.mint(selling.address, amount)).to.be.fulfilled;

    await expect(selling.emptyReserve(fromUser)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(selling.emptyReserve()).to.be.fulfilled;

    await expect(
      usdc.balanceOf(selling.address)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(usdc.balanceOf(owner)).to.eventually.be.a.bignumber.equal(
      amount
    );
  });

  it("returnCrunchs()", async () => {
    const totalSupply = await crunch.totalSupply();

    await expect(selling.returnCrunchs()).to.be.rejectedWith(
      Error,
      "Selling: no crunch"
    );

    await expect(crunch.transfer(selling.address, totalSupply)).to.be.fulfilled;

    await expect(selling.returnCrunchs(fromUser)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(selling.returnCrunchs()).to.be.fulfilled;

    await expect(
      crunch.balanceOf(selling.address)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(crunch.balanceOf(owner)).to.eventually.be.a.bignumber.equal(
      totalSupply
    );
  });

  it("pause()", async () => {
    await expect(selling.pause(fromUser)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(selling.pause()).to.be.fulfilled;

    await expect(selling.paused()).to.eventually.be.true;

    await expect(selling.pause()).to.be.rejectedWith(Error, "Pausable: paused");
  });

  it("unpause()", async () => {
    await expect(selling.pause()).to.be.fulfilled;

    await expect(selling.unpause(fromUser)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(selling.unpause()).to.be.fulfilled;

    await expect(selling.paused()).to.eventually.be.false;

    await expect(selling.unpause()).to.be.rejectedWith(
      Error,
      "Pausable: not paused"
    );
  });

  it("setCrunch(address)", async () => {
    const dummy = await CrunchToken.new();

    await expect(selling.setCrunch(dummy.address, fromUser)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(selling.setCrunch(dummy.address)).to.be.fulfilled;

    await expect(selling.crunch()).to.eventually.be.equal(dummy.address);
  });

  it("setUsdc(address)", async () => {
    const dummy = await USDCoin.new();

    await expect(selling.setUsdc(dummy.address, fromUser)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(selling.setUsdc(dummy.address)).to.be.fulfilled;

    await expect(selling.usdc()).to.eventually.be.equal(dummy.address);
  });

  it("setPrice(uint256)", async () => {
    const newPrice = FORTY_TWO;

    await expect(selling.setPrice(newPrice, fromUser)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(selling.setPrice(newPrice)).to.be.fulfilled;

    await expect(selling.price()).to.eventually.be.a.bignumber.equal(newPrice);
  });
});
