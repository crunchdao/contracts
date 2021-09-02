const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchVesting = artifacts.require("CrunchVesting");

contract("Crunch Vesting", async (accounts) => {
  let crunch;
  let vesting;

  const [owner, beneficiary] = accounts;

  const hourInSeconds = (hour) => hour * 3600;
  const amount = 1000;
  const cliffInHour = 2;
  const durationInHour = 10;
  const amountPerDuration = amount / durationInHour;

  // x x y y y y y y y y
  // 1 2 3 4 5 6 7 8 9 0

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    vesting = await CrunchVesting.new(
      crunch.address,
      beneficiary,
      hourInSeconds(cliffInHour),
      hourInSeconds(durationInHour)
    );

    await crunch.transfer(vesting.address, amount);
  });

  it("release() : before cliff", async () => {
    await expect(vesting.release()).to.be.rejected;
  });

  it("release() : after cliff", async () => {
    await advance.timeAndBlock(hourInSeconds(cliffInHour));

    await expect(vesting.release()).to.be.fulfilled;
  });

  it("release() : after duration/2 hours", async () => {
    await advance.timeAndBlock(hourInSeconds(durationInHour / 2));

    await expect(vesting.release()).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(
      new BN(amountPerDuration * (durationInHour / 2))
    );
  });

  it("revoke() : one time", async () => {
    await expect(vesting.revoke()).to.be.fulfilled;
  });

  it("revoke() : two time", async () => {
    await expect(vesting.revoke()).to.be.fulfilled;
    await expect(vesting.revoke()).to.be.rejected;
  });

  it("revoke() : before cliff", async () => {
    await expect(vesting.revoke()).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN(0));
  });

  it("revoke() : after cliff", async () => {
    await advance.timeAndBlock(hourInSeconds(cliffInHour));

    await expect(vesting.revoke()).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN(0));
  });

  it("revoke() : after duration/2 hours", async () => {
    await advance.timeAndBlock(hourInSeconds(durationInHour / 2));

    await expect(vesting.revoke()).to.be.fulfilled;
    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN(0));
  });

  it("vestedAmount() : before cliff", async () => {
    await expect(vesting.vestedAmount()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("vestedAmount() : after cliff", async () => {
    await advance.timeAndBlock(hourInSeconds(cliffInHour));

    await expect(vesting.vestedAmount()).to.eventually.be.a.bignumber.equal(
      new BN(amountPerDuration * cliffInHour)
    );
  });

  it("vestedAmount() : after total duration", async () => {
    await advance.timeAndBlock(hourInSeconds(durationInHour));

    await expect(vesting.vestedAmount()).to.eventually.be.a.bignumber.equal(
      new BN(amount)
    );
  });
});
