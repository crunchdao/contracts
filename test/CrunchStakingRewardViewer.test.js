const advance = require("./helper/advance");
const time = require("./helper/time");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchStaking = artifacts.require("CrunchStaking");
const CrunchStakingRewardViewer = artifacts.require(
  "CrunchStakingRewardViewer"
);

contract("Crunch Stacking Reward Viewer", async (accounts) => {
  let crunch;
  let staking;

  const [owner, staker] = accounts;
  const initialStakerBalance = 10000;

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    staking = await CrunchStaking.new(crunch.address, 657);
    viewer = await CrunchStakingRewardViewer.new(
      crunch.address,
      staking.address
    );

    await crunch.transfer(staker, initialStakerBalance);
  });

  it("name()", async () => {
    await expect(viewer.name()).to.eventually.be.equal("Crunch Staking Token");
  });

  it("symbol()", async () => {
    await expect(viewer.symbol()).to.eventually.be.equal("sCRUNCH");
  });

  it("decimals()", async () => {
    await expect(viewer.decimals()).to.eventually.be.a.bignumber.equal(
      await crunch.decimals()
    );
  });

  it("totalSupply()", async () => {
    await expect(viewer.totalSupply()).to.eventually.be.a.bignumber.equal(
      await crunch.balanceOf(staking.address)
    );

    await expect(crunch.transfer(staking.address, 1000)).to.be.fulfilled;

    await expect(viewer.totalSupply()).to.eventually.be.a.bignumber.equal(
      await crunch.balanceOf(staking.address)
    );

    await expect(crunch.transferAndCall(staking.address, 1000, "0x0")).to.be
      .fulfilled;
    await expect(staking.isCallerStaking()).to.eventually.be.true;

    await expect(viewer.totalSupply()).to.eventually.be.a.bignumber.equal(
      await crunch.balanceOf(staking.address)
    );

    await expect(staking.withdraw()).to.be.fulfilled;
    await expect(staking.isCallerStaking()).to.eventually.be.false;
  });

  it("balanceOf(address)", async () => {
    const amount = 100;

    await expect(viewer.balanceOf(owner)).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );

    await expect(crunch.transferAndCall(staking.address, amount, "0x0")).to.be
      .fulfilled;

    await expect(viewer.balanceOf(owner)).to.eventually.be.a.bignumber.equal(
      new BN(amount)
    );

    await advance.timeAndBlock(time.oneYear);

    await expect(
      viewer.balanceOf(owner)
    ).to.eventually.be.a.bignumber.greaterThan(new BN(amount));
  });

  it("transfer(address, uint256)", async () => {
    await expect(viewer.transfer(owner, 1)).to.be.rejected;
  });

  it("allowance(address, address)", async () => {
    await expect(viewer.transfer(owner, owner)).to.be.rejected;
  });

  it("approve(address, uint256)", async () => {
    await expect(viewer.approve(owner, 1)).to.be.rejected;
  });

  it("transferFrom(address, address, uint256)", async () => {
    await expect(viewer.approve(owner, owner, 1)).to.be.rejected;
  });
});
