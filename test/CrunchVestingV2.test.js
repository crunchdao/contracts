const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");
const time = require("./helper/time");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchVestingV2 = artifacts.require("CrunchVestingV2");

const ZERO = new BN("0");

contract("Crunch Vesting", async (accounts) => {
  let crunch;
  let vesting;

  const [owner, beneficiary] = accounts;

  const amount = new BN(1000);
  const cliff = new BN(time.days(2));
  const duration = new BN(time.days(10));

  beforeEach(async () => {
    crunch = await CrunchToken.new();

    vesting = await CrunchVestingV2.new(
      crunch.address,
      beneficiary,
      cliff,
      duration
    );

    await crunch.transfer(vesting.address, amount);
  });

  it("owner()", async () => {
    await expect(vesting.owner()).to.eventually.be.equal(owner);
  });

  it("crunch()", async () => {
    await expect(vesting.crunch()).to.eventually.be.equal(crunch.address);
  });

  it("remainingAmount()", async () => {
    await expect(vesting.remainingAmount()).to.eventually.be.a.bignumber.equal(
      amount
    );

    await advance.timeAndBlock(duration.divn(2));

    await expect(vesting.release()).to.be.fulfilled;

    await expect(vesting.remainingAmount()).to.eventually.be.a.bignumber.equal(
      amount.divn(2)
    );

    await advance.timeAndBlock(duration.divn(2));

    await expect(vesting.release()).to.be.fulfilled;

    await expect(vesting.remainingAmount()).to.eventually.be.a.bignumber.equal(
      ZERO
    );
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
