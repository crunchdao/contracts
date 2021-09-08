const advance = require("./helper/advance");
const time = require("./helper/time");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchStaking = artifacts.require("CrunchStaking");

contract("Crunch Stacking", async (accounts) => {
  let crunch;
  let staking;

  const [owner, staker1, staker2, staker3] = accounts;
  const initialStakerBalance = 10000;

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    staking = await CrunchStaking.new(crunch.address, 657);

    for (const staker of [staker1, staker2, staker3]) {
      await crunch.transfer(staker, initialStakerBalance);
    }
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

  it("onTokenTransfer(address, uint256, bytes) : (0x1, 0, 0x0)", async () => {
    await expect(crunch.transferAndCall(staking.address, 0, "0x0")).to.be
      .rejected;
  });

  it("onTokenTransfer(address, uint256, bytes) : (0x1, 100, 0x0)", async () => {
    await expect(crunch.transferAndCall(staking.address, 100, "0x0")).to.be
      .fulfilled;
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

    await expect(before.sub(after).toNumber()).to.be.equal(0);
  });

  it("withdraw() : staking 100, no reserve", async () => {
    const amount = 100;

    await crunch.transferAndCall(staking.address, amount, "0x0");

    await advance.timeAndBlock(time.oneYear);

    await expect(staking.withdraw()).to.be.rejected;
  });

  it("withdraw() : staking 100, with reserve", async () => {
    const amount = 100;
    const reserve = 1000;

    await crunch.transferAndCall(staking.address, amount, "0x0");

    await advance.timeAndBlock(time.oneYear);

    await crunch.transfer(staking.address, reserve /* not testing the value */);

    await expect(staking.contractBalance()).to.eventually.be.a.bignumber.equal(
      new BN(reserve + amount)
    );
    await expect(staking.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve)
    );

    await expect(staking.withdraw()).to.be.fulfilled;
  });

  it("totalStaked() : nobody", async () => {
    await expect(staking.totalStaked()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("totalStaked() : staking 100", async () => {
    const amount = 100;

    await crunch.transferAndCall(staking.address, amount, "0x0");

    await expect(staking.totalStaked()).to.eventually.be.a.bignumber.equal(
      new BN(amount)
    );
  });

  it("totalStaked() : staking 100 * 2", async () => {
    const amount = 100;

    await crunch.transferAndCall(staking.address, amount, "0x0");
    await crunch.transferAndCall(staking.address, amount, "0x0", {
      from: staker1,
    });

    await expect(staking.totalStaked()).to.eventually.be.a.bignumber.equal(
      new BN(amount * 2)
    );

    await expect(staking.withdraw()).to.be.fulfilled;

    await expect(staking.totalStaked()).to.eventually.be.a.bignumber.equal(
      new BN(amount)
    );

    await expect(staking.withdraw({ from: staker1 })).to.be.fulfilled;

    await expect(staking.totalStaked()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("totalStakedOf(address) : not staking", async () => {
    await expect(staking.totalStakedOf(staker1)).to.eventually.be.a.bignumber.equal(new BN(0));
  });

  it("totalStakedOf(address) : staking 100", async () => {
    const amount = 100;

    await crunch.transferAndCall(staking.address, amount, "0x0", {
      from: staker1,
    });
    await crunch.transferAndCall(staking.address, amount, "0x0", {
      from: staker2,
    });

    await expect(
      staking.totalStakedOf(staker1)
    ).to.eventually.be.a.bignumber.equal(new BN(amount));

    await expect(
      staking.totalStakedOf(staker2)
    ).to.eventually.be.a.bignumber.equal(new BN(amount));
  });

  it("totalStaked() : staking 100 * 2, same person", async () => {
    const amount = 100;

    await crunch.transferAndCall(staking.address, amount, "0x0");
    await crunch.transferAndCall(staking.address, amount, "0x0");

    await expect(staking.totalStaked()).to.eventually.be.a.bignumber.equal(
      new BN(amount * 2)
    );

    await expect(staking.withdraw()).to.be.fulfilled;

    await expect(staking.totalStaked()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
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

    await expect(crunch.transferAndCall(staking.address, 100, "0x0")).to.be
      .fulfilled;

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

  it("reserve()", async () => {
    const amount = 100;

    await expect(staking.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );

    await crunch.transfer(staking.address, amount);

    await expect(staking.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(amount)
    );

    await crunch.transferAndCall(staking.address, amount, "0x0");

    await expect(staking.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(amount)
    );

    await staking.withdraw();

    await expect(staking.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(amount)
    );
  });

  it("contractBalance()", async () => {
    const amount = 100;

    await expect(staking.contractBalance()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );

    await crunch.transfer(staking.address, amount);

    await expect(staking.contractBalance()).to.eventually.be.a.bignumber.equal(
      new BN(amount)
    );

    await crunch.transferAndCall(staking.address, amount, "0x0");

    await expect(staking.contractBalance()).to.eventually.be.a.bignumber.equal(
      new BN(amount * 2)
    );

    await staking.withdraw();

    await expect(staking.contractBalance()).to.eventually.be.a.bignumber.equal(
      new BN(amount)
    );
  });

  it("destroy()", async () => {
    const reserve = 100;

    const before = await crunch.balanceOf(owner);

    await crunch.transfer(staking.address, reserve);

    await expect(staking.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve)
    );

    await expect(staking.destroy()).to.be.fulfilled;
    await expect(staking.contractBalance()).to.be.rejected; /* since destroyed */

    await expect(crunch.balanceOf(owner)).to.eventually.be.a.bignumber.equal(before);
  });

  it("destroy() : not enough reserve", async () => {
    const amount = 10000;
    const reserve = 10;

    await crunch.transferAndCall(staking.address, amount, "0x0");
    await crunch.transfer(staking.address, reserve);

    await advance.timeAndBlock(time.oneYear);

    await expect(staking.destroy()).to.be.rejected;
  });

  it("destroy() : enough reserve", async () => {
    const amount = 10000;
    const reserve = 10000;

    const stakerBefore = await crunch.balanceOf(staker1);
    const owerBefore = await crunch.balanceOf(owner);

    await crunch.transferAndCall(staking.address, amount, "0x0", { from: staker1 });
    await crunch.transfer(staking.address, reserve);

    await advance.timeAndBlock(time.oneYear);

    await expect(staking.destroy()).to.be.fulfilled;
    await expect(staking.contractBalance()).to.be.rejected; /* since destroyed */

    await expect(crunch.balanceOf(staker1)).to.eventually.be.a.bignumber.greaterThan(stakerBefore);
    await expect(crunch.balanceOf(owner)).to.eventually.be.a.bignumber.lessThan(owerBefore);
  });

  it("emergencyDestroy()", async () => {
    const reserve = 100;

    const before = await crunch.balanceOf(owner);

    await crunch.transfer(staking.address, reserve);

    await expect(staking.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve)
    );

    await expect(staking.emergencyDestroy()).to.be.fulfilled;
    await expect(staking.contractBalance()).to.be.rejected; /* since destroyed */

    await expect(crunch.balanceOf(owner)).to.eventually.be.a.bignumber.equal(before);
  });

  it("emergencyDestroy() : not enough reserve", async () => {
    const amount = 10000;
    const reserve = 10;

    const stakerBefore = await crunch.balanceOf(staker1);
    const owerBefore = await crunch.balanceOf(owner);

    await crunch.transferAndCall(staking.address, amount, "0x0");
    await crunch.transfer(staking.address, reserve);

    await advance.timeAndBlock(time.oneYear);

    await expect(staking.emergencyDestroy()).to.be.fulfilled;
    await expect(staking.contractBalance()).to.be.rejected; /* since destroyed */

    await expect(crunch.balanceOf(staker1)).to.eventually.be.a.bignumber.equal(stakerBefore);
    await expect(crunch.balanceOf(owner)).to.eventually.be.a.bignumber.equal(owerBefore);
  });

  it("emergencyDestroy() : enough reserve", async () => {
    const amount = 10000;
    const reserve = 10000;

    const stakerBefore = await crunch.balanceOf(staker1);
    const owerBefore = await crunch.balanceOf(owner);

    await crunch.transferAndCall(staking.address, amount, "0x0", { from: staker1 });
    await crunch.transfer(staking.address, reserve);

    await advance.timeAndBlock(time.oneYear);

    await expect(staking.emergencyDestroy()).to.be.fulfilled;
    await expect(staking.contractBalance()).to.be.rejected; /* since destroyed */

    await expect(crunch.balanceOf(staker1)).to.eventually.be.a.bignumber.equal(stakerBefore);
    await expect(crunch.balanceOf(owner)).to.eventually.be.a.bignumber.equal(owerBefore);
  });
});
