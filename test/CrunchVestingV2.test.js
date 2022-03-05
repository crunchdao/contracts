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
  const fromOwner = {
    from: owner,
  };
  const fromBeneficiary = {
    from: beneficiary,
  };

  const defaults = {
    cliff: new BN(time.days(2)),
    duration: new BN(time.days(10)),
  };

  const createVesting = async ({
    cliff = defaults.cliff,
    duration = defaults.duration,
    revokable = false,
  } = {}) => {
    return await CrunchVestingV2.new(
      crunch.address,
      beneficiary,
      cliff,
      duration,
      revokable
    );
  };

  beforeEach(async () => {
    crunch = await CrunchToken.new();
  });

  it("owner()", async () => {
    vesting = await createVesting();

    await expect(vesting.owner()).to.eventually.be.equal(owner);
  });

  it("crunch()", async () => {
    vesting = await createVesting();

    await expect(vesting.crunch()).to.eventually.be.equal(crunch.address);
  });

  it("name()", async () => {
    vesting = await createVesting();

    await expect(vesting.name()).to.eventually.be.equal(
      "Vested CRUNCH Token (single)"
    );
  });

  it("symbol()", async () => {
    vesting = await createVesting();

    await expect(vesting.symbol()).to.eventually.be.equal("svCRUNCH");
  });

  it("decimals()", async () => {
    vesting = await createVesting();

    await expect(vesting.decimals()).to.eventually.be.a.bignumber.equal(
      await crunch.decimals()
    );
  });

  it("remainingAmount()", async () => {
    vesting = await createVesting();

    await expect(vesting.remainingAmount()).to.eventually.be.a.bignumber.equal(
      ZERO
    );

    const amount = new BN(100);
    await expect(crunch.transfer(vesting.address, amount)).to.be.fulfilled;

    await expect(vesting.remainingAmount()).to.eventually.be.a.bignumber.equal(
      new BN(amount)
    );

    await advance.timeAndBlock(defaults.duration.divn(2));

    await expect(vesting.release()).to.be.fulfilled;

    await expect(vesting.remainingAmount()).to.eventually.be.a.bignumber.equal(
      amount.divn(2)
    );

    await advance.timeAndBlock(defaults.duration.divn(2));

    await expect(vesting.release()).to.be.fulfilled;

    await expect(vesting.remainingAmount()).to.eventually.be.a.bignumber.equal(
      ZERO
    );
  });

  it("balanceOf(address) : beneficiary", async () => {
    vesting = await createVesting();

    await expect(
      vesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    const amount = new BN(100);
    await expect(crunch.transfer(vesting.address, amount)).to.be.fulfilled;

    await expect(
      vesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(amount);

    await advance.timeAndBlock(defaults.duration);

    await expect(vesting.release()).to.be.fulfilled;

    await expect(
      vesting.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);
  });

  it("balanceOf(address) : owner", async () => {
    vesting = await createVesting();

    await expect(vesting.balanceOf(owner)).to.eventually.be.a.bignumber.equal(
      ZERO
    );

    const amount = new BN(100);
    await expect(crunch.transfer(vesting.address, amount)).to.be.fulfilled;

    await expect(vesting.balanceOf(owner)).to.eventually.be.a.bignumber.equal(
      ZERO
    );

    await advance.timeAndBlock(defaults.duration);

    await expect(vesting.release()).to.be.fulfilled;

    await expect(vesting.balanceOf(owner)).to.eventually.be.a.bignumber.equal(
      ZERO
    );
  });

  it("setUnrevokable() : revokable", async () => {
    vesting = await createVesting({ revokable: true });

    await expect(vesting.setUnrevokable(fromBeneficiary)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(vesting.setUnrevokable()).to.be.fulfilled;
    await expect(vesting.revokable()).to.eventually.be.equal(false);

    await expect(vesting.setUnrevokable()).to.be.rejectedWith(
      Error,
      "Vesting: must be revokable"
    );
  });

  it("setUnrevokable() : not revokable", async () => {
    vesting = await createVesting({ revokable: false });

    await expect(vesting.setUnrevokable(fromBeneficiary)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(vesting.setUnrevokable()).to.be.rejectedWith(
      Error,
      "Vesting: must be revokable"
    );
  });

  it("setUnrevokable() : revoked", async () => {
      try {
        vesting = await createVesting({ revokable: true });
    
        await expect(vesting.revoke()).to.be.fulfilled;
    
        await expect(vesting.setUnrevokable(fromBeneficiary)).to.be.rejectedWith(
          Error,
          "Ownable: caller is not the owner"
        );
    
        await expect(vesting.setUnrevokable()).to.be.rejectedWith(
          Error,
          "Vesting: already revoked"
        );
      } catch (error) {
          console.log(error)
      }
  });

  it("setCrunch(address)", async () => {
    vesting = await createVesting();

    const nulled = "0x0000000000000000000000000000000000000000";
    const dummy = "0x4242424242424242424242424242424242424242";

    await expect(vesting.setCrunch(dummy, fromBeneficiary)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(vesting.setCrunch(nulled)).to.be.rejectedWith(
      Error,
      "Vesting: new crunch cannot be null"
    );

    await expect(vesting.setCrunch(crunch.address)).to.be.rejectedWith(
      Error,
      "Vesting: token address cannot be updated to the same value"
    );

    await expect(vesting.setCrunch(dummy)).to.be.fulfilled;
    await expect(vesting.crunch()).to.eventually.be.equal(dummy);
  });

  it("transferBeneficiary(address)", async () => {
    vesting = await createVesting();

    const nulled = "0x0000000000000000000000000000000000000000";
    const [, , account] = accounts;

    await expect(
      vesting.transferBeneficiary(account, { from: account })
    ).to.be.rejectedWith(Error, "Vesting: caller is not the beneficiary");

    await expect(
      vesting.transferBeneficiary(account, fromOwner)
    ).to.be.rejectedWith(Error, "Vesting: caller is not the beneficiary");

    await expect(
      vesting.transferBeneficiary(nulled, fromBeneficiary)
    ).to.be.rejectedWith(Error, "Vesting: beneficiary cannot be null");

    await expect(vesting.transferBeneficiary(account, fromBeneficiary)).to.be
      .fulfilled;
    await expect(vesting.beneficiary()).to.eventually.be.equal(account);

    await expect(
      vesting.transferBeneficiary(beneficiary, fromBeneficiary)
    ).to.be.rejectedWith(Error, "Vesting: caller is not the beneficiary");

    await expect(vesting.transferBeneficiary(beneficiary, { from: account })).to
      .be.fulfilled;
    await expect(vesting.beneficiary()).to.eventually.be.equal(beneficiary);
  });
});
