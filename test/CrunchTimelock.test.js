const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchTimelock = artifacts.require("CrunchTimelock");

contract("Crunch Timelock", async (accounts) => {
  let crunch;
  let timelock;

  const [owner, beneficiary] = accounts;

  const hourInSeconds = (hour) => hour * 3600;
  const amount = 1000;
  const releaseTimeInHour = 10;

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    timelock = await CrunchTimelock.new(
      crunch.address,
      beneficiary,
      hourInSeconds(releaseTimeInHour)
    );
  });

  it("release() : before time", async () => {
    await expect(timelock.release()).to.be.rejected;
  });

  it("release() : after time, no token", async () => {
    await advance.timeAndBlock(hourInSeconds(releaseTimeInHour));

    await expect(timelock.release()).to.be.rejected;
  });

  it("release() : after time, with token", async () => {
    await crunch.transfer(timelock.address, amount);

    await advance.timeAndBlock(hourInSeconds(releaseTimeInHour));

    await expect(timelock.release()).to.be.fulfilled;
  });
});
