const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchStaking = artifacts.require("CrunchStaking");
const Stakeholding = artifacts.require("Stakeholding");

contract("Crunch Stacking", async (accounts) => {
  let crunch;
  let staking;

  const [owner, staker1, staker2, staker3] = accounts;

  beforeEach(async () => {
    const lib = await Stakeholding.new();

    crunch = await CrunchToken.new();
    await CrunchStaking.link("Stakeholding", lib.address);
    staking = await CrunchStaking.new(crunch.address, 657);

    await crunch.transfer(staker1, 10000);
    await crunch.transfer(staker2, 10000);
    await crunch.transfer(staker3, 10000);
  });

  it("deposit(uint256) : (0)", async () => {
    await expect(staking.deposit(0)).to.be.rejected;
  });

  it("deposit(uint256) : (100), but not approved", async () => {
    await expect(staking.deposit(100)).to.be.rejected;
  });

  it("deposit(uint256) : (100)", async () => {
    await crunch.approve(staking.address, 100);

    // await new Promise((accept, reject) => {
    //   staking
    //     .deposit(100)
    //     .then(accept)
    //     .catch((err) => {
    //       console.log(err);
    //       reject(err);
    //     });
    // });
    await expect(staking.deposit(100)).to.be.fulfilled;
    await expect(staking.isStaking()).to.eventually.be.true;
  });

  it("withdraw() : not staking", async () => {
    await expect(staking.withdraw()).to.be.rejected;
  });

  it("withdraw() : staking 100", async () => {
    const amount = 100;

    await crunch.approve(staking.address, amount);

    const before = await crunch.balanceOf(accounts[0]);

    await expect(staking.deposit(amount)).to.be.fulfilled;
    await expect(staking.withdraw()).to.be.fulfilled;
    await expect(staking.isStaking()).to.eventually.be.false;

    const after = await crunch.balanceOf(accounts[0]);

    await expect(before.sub(after).toNumber()).to.be.equal(amount);
  });

  it("stakerCount()", async () => {
    await expect(staking.stakerCount()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );

    await expect(
      crunch.transferAndCall(staking.address, 100, "0x0", { from: staker1 })
    ).to.be.fulfilled;

    await expect(staking.stakerCount()).to.eventually.be.a.bignumber.equal(
      new BN(1)
    );

    await expect(
      crunch.transferAndCall(staking.address, 100, "0x0", { from: staker2 })
    ).to.be.fulfilled;

    await expect(staking.stakerCount()).to.eventually.be.a.bignumber.equal(
      new BN(2)
    );

    await expect(staking.withdraw({ from: staker1 })).to.be.fulfilled;

    await expect(staking.stakerCount()).to.eventually.be.a.bignumber.equal(
      new BN(1)
    );

    await expect(staking.withdraw({ from: staker2 })).to.be.fulfilled;

    await expect(staking.stakerCount()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("stakerCount() : avoid duplicate", async () => {
    await expect(staking.stakerCount()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );

    await expect(
      crunch.transferAndCall(staking.address, 100, "0x0", { from: staker1 })
    ).to.be.fulfilled;

    await expect(staking.stakerCount()).to.eventually.be.a.bignumber.equal(
      new BN(1)
    );

    await expect(
      crunch.transferAndCall(staking.address, 100, "0x0", { from: staker1 })
    ).to.be.fulfilled;

    await expect(staking.stakerCount()).to.eventually.be.a.bignumber.equal(
      new BN(1)
    );

    await expect(staking.withdraw({ from: staker1 })).to.be.fulfilled;

    await expect(staking.stakerCount()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("isStaking()", async () => {
    await expect(staking.isStaking()).to.eventually.be.false;

    await expect(
      crunch.transferAndCall(staking.address, 100, "0x0")
    ).to.be.fulfilled;

    await expect(staking.isStaking()).to.eventually.be.true;

    await expect(staking.withdraw()).to.be.fulfilled;

    await expect(staking.isStaking()).to.eventually.be.false;
  });

  it("isStaking(address)", async () => {
    await expect(staking.isStaking(staker1)).to.eventually.be.false;

    await expect(
      crunch.transferAndCall(staking.address, 100, "0x0", { from: staker1 })
    ).to.be.fulfilled;

    await expect(staking.isStaking(staker1)).to.eventually.be.true;

    await expect(staking.withdraw({ from: staker1 })).to.be.fulfilled;

    await expect(staking.isStaking(staker1)).to.eventually.be.false;
  });
});
