const advance = require("./helper/advance");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchStacking = artifacts.require("CrunchStacking");

contract("Crunch Stacking", async (accounts) => {
  it("should be able to update the yield", async () => {
    const instance = await CrunchStacking.deployed();

    const value = 42;

    await instance.setYield(value);

    assert.equal((await instance.yield()).toNumber(), value);
  });

  it("should be added to stakeholders", async () => {
    const instance = await CrunchStacking.deployed();

    const value = 42;

    await instance.deposit(value);

    assert.isTrue(await instance.isStakeholder(accounts[0]));
  });

  it("should be able to quit stakeholders", async () => {
    const instance = await CrunchStacking.deployed();

    const value = 42;

    await instance.deposit(value);
    assert.isTrue(await instance.isStakeholder(accounts[0]));

    await instance.withdraw();
    assert.isFalse(await instance.isStakeholder(accounts[0]));
  });

  it("should be able to get 50 reward after a month with initial=100 and yield=2", async () => {
    const instance = await CrunchStacking.deployed();

    const yield = 2;
    const amount = 100;
    const reward = 50;

    await instance.setYield(yield);
    assert.equal((await instance.yield()).toNumber(), yield);

    await instance.deposit(amount);
    assert.isTrue(await instance.isStakeholder(accounts[0]));

    const secondsUntilNextMonth = 2629800;
    await advance.timeAndBlock(secondsUntilNextMonth);

    assert.equal((await instance.computeReward(accounts[0])).toNumber(), reward);
  });
});
