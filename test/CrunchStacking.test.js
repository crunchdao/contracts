const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchStacking = artifacts.require("CrunchStacking");

const INITIAL_YIELD = 1;

contract("Crunch Stacking", async (accounts) => {
  let stacking;

  beforeEach(async () => {
    const crunch = await CrunchToken.deployed();
    stacking = await CrunchStacking.new(crunch.address, INITIAL_YIELD);
  });

  it("should be able to update the yield", async () => {
    const value = 42;

    await stacking.setYield(value);

    expect(stacking.yield()).to.eventually.be.a.bignumber.equal(new BN(value));
  });

  it("should not be able to update the yield to the same value", async () => {
    const yield = await stacking.yield();

    expect(stacking.setYield(yield)).to.eventually.be.rejected;
  });

  it("should be added to stakeholders", async () => {
    const value = 42;

    await stacking.deposit(value);

    expect(stacking.isStakeholder(accounts[0])).to.eventually.be.true;
  });

  it("should be able to quit stakeholders", async () => {
    const value = 42;

    await stacking.deposit(value);
    expect(stacking.isStakeholder(accounts[0])).to.eventually.be.true;

    await stacking.withdraw();
    expect(stacking.isStakeholder(accounts[0])).to.eventually.be.false;
  });

  it("should be able to get 50 reward after a month with initial=100 and yield=2", async () => {
    const yield = 2;
    const amount = 100;
    const reward = 50;

    await stacking.setYield(yield);
    expect(stacking.yield()).to.eventually.be.a.bignumber.equal(new BN(yield));

    await stacking.deposit(amount);
    expect(stacking.isStakeholder(accounts[0])).to.eventually.be.true;

    const secondsUntilNextMonth = 2629800;
    await advance.timeAndBlock(secondsUntilNextMonth);

    expect(
      stacking.computeReward(accounts[0])
    ).to.eventually.be.a.bignumber.equal(new BN(reward));
  });

  it("should be able to get 0 reward after a minute with initial=100 and yield=3", async () => {
    const yield = 3;
    const amount = 100;
    const reward = 0;

    await stacking.setYield(yield);
    expect(stacking.yield()).to.eventually.be.a.bignumber.equal(new BN(yield));

    await stacking.deposit(amount);
    expect(stacking.isStakeholder(accounts[0])).to.eventually.be.true;

    const secondsUntilNextMinute = 60;
    await advance.timeAndBlock(secondsUntilNextMinute);

    expect(
      stacking.computeReward(accounts[0])
    ).to.eventually.be.a.bignumber.equal(new BN(reward));
  });

  it("should not be able to withdraw if not stacking", async () => {
    expect(stacking.withdraw()).to.eventually.be.rejected;
  });
});
