const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchStaking = artifacts.require("CrunchStaking");
const Stakeholding = artifacts.require("Stakeholding");

contract("Crunch Stacking", async (accounts) => {
  let crunch;
  let staking;

  const [owner, staker1, staker2, staker3] = accounts;
  const initialStakerBalance = 10000;

  beforeEach(async () => {
    const lib = await Stakeholding.new();

    crunch = await CrunchToken.new();
    await CrunchStaking.link("Stakeholding", lib.address);
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
    await expect(staking.totalStakedOf(staker1)).to.be.rejected;
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
});
