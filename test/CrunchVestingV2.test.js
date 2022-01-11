const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchVestingV2 = artifacts.require("CrunchVestingV2");

contract("Crunch Vesting", async (accounts) => {
  let crunch;
  let vesting;

  const [owner, beneficiary] = accounts;

  const hourInSeconds = (hour) => hour * 3600;
  const amount = 1000;
  const cliffInHour = 2;
  const durationInHour = 10;

  beforeEach(async () => {
    crunch = await CrunchToken.new();

    vesting = await CrunchVestingV2.new(
      crunch.address,
      beneficiary,
      hourInSeconds(cliffInHour),
      hourInSeconds(durationInHour)
    );

    await crunch.transfer(vesting.address, amount);
  });

  it("owner()", async () => {
    await expect(vesting.owner()).to.eventually.be.equal(owner);
  });

  it("crunch()", async () => {
    await expect(vesting.crunch()).to.eventually.be.equal(crunch.address);
  });

  it("setCrunch(address)", async () => {
    const nulled = "0x0000000000000000000000000000000000000000";
    const dummy = "0x4242424242424242424242424242424242424242";
    const [, , account] = accounts;

    /* not from owner */
    await expect(vesting.setCrunch(dummy, { from: account })).to.be.rejected;

    /* null address */
    await expect(vesting.setCrunch(nulled)).to.be.rejected;

    await expect(vesting.setCrunch(dummy)).to.be.fulfilled;
    await expect(vesting.crunch()).to.eventually.be.equal(dummy);
  });

  it("transferBeneficiary(address)", async () => {
    const nulled = "0x0000000000000000000000000000000000000000";
    const [, , account] = accounts;

    /* not from owner */
    await expect(vesting.transferBeneficiary(account, { from: account })).to.be
      .rejected;

    /* not from owner */
    await expect(vesting.transferBeneficiary(account, { from: owner })).to.be
      .rejected;

    /* null address */
    await expect(vesting.transferBeneficiary(nulled, { from: beneficiary })).to
      .be.rejected;

    await expect(vesting.transferBeneficiary(account, { from: beneficiary })).to
      .be.fulfilled;
    await expect(vesting.beneficiary()).to.eventually.be.equal(account);

    /* not from new owner */
    await expect(
      vesting.transferBeneficiary(beneficiary, { from: beneficiary })
    ).to.be.rejected;

    await expect(vesting.transferBeneficiary(beneficiary, { from: account })).to
      .be.fulfilled;
    await expect(vesting.beneficiary()).to.eventually.be.equal(beneficiary);
  });
});
