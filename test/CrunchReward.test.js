const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchReward = artifacts.require("CrunchReward");

contract("Crunch Reward", async (accounts) => {
  let crunch;
  let reward;

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    reward = await CrunchReward.new(crunch.address);
  });

  it("distribute(address[] memory, uint256[] memory) : empty values", async () => {
    const reserve = 100;

    await crunch.transfer(reward.address, reserve);

    await expect(reward.distribute([], [])).to.be.rejected;
    await expect(reward.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve)
    );
  });

  it("distribute(address[] memory, uint256[] memory) : not enough balance", async () => {
    const reserve = 100;

    await crunch.transfer(reward.address, reserve);

    const recipients = [accounts[1], accounts[2]];
    const values = [reserve, reserve];

    await expect(reward.distribute(recipients, values)).to.be.rejected;
    await expect(reward.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve)
    );
  });

  it("distribute(address[] memory, uint256[] memory) : 2 recipients, 1 value", async () => {
    const reserve = 100;

    await crunch.transfer(reward.address, reserve);

    const recipients = [accounts[1], accounts[2]];
    const values = [10];

    await expect(reward.distribute(recipients, values)).to.be.rejected;
    await expect(reward.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve)
    );
  });

  it("distribute(address[] memory, uint256[] memory) : ([0x1, 0x2], [10, 10])", async () => {
    const reserve = 100;

    await crunch.transfer(reward.address, 100);

    const recipients = [accounts[1], accounts[2]];
    const values = [10, 10];

    await expect(reward.distribute(recipients, values)).to.be.fulfilled;
    await expect(reward.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve - values.reduce((a, b) => a + b, 0))
    );
  });

  it("distribute(address[] memory, uint256[] memory) : everything", async () => {
    const reserve = 100;

    await crunch.transfer(reward.address, 100);

    const recipients = [accounts[1], accounts[2]];
    const values = [reserve / 2, reserve / 2];

    await expect(reward.distribute(recipients, values)).to.be.fulfilled;
    await expect(reward.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("empty() : when already empty", async () => {
    await expect(reward.empty()).to.be.rejected;
  });

  it("empty() : when have remaining", async () => {
    await crunch.transfer(reward.address, 100);

    await expect(reward.empty()).to.be.fulfilled;
    await expect(reward.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("reserve() : when empty", async () => {
    await expect(reward.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("reserve() : when have some", async () => {
    await crunch.transfer(reward.address, 100);

    await expect(reward.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(100)
    );

    await crunch.transfer(reward.address, 200);

    await expect(reward.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(300)
    );
  });

  it("destroy() : when empty", async () => {
    await reward.destroy();

    await expect(reward.reserve()).to.be.rejected; /* test if killed */
    await expect(
      crunch.balanceOf(reward.address)
    ).to.eventually.be.a.bignumber.equal(new BN(0));
  });

  it("destroy() : when have some", async () => {
    const reserve = 100;

    await crunch.transfer(reward.address, reserve);

    await reward.destroy();

    await expect(reward.reserve()).to.be.rejected; /* test if killed */
    await expect(
      await crunch.balanceOf(reward.address)
    ).to.be.a.bignumber.equal(new BN(0));
    await expect(await crunch.balanceOf(accounts[0])).to.be.a.bignumber.equal(
      await crunch.totalSupply()
    );
  });
});
