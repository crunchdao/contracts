const truffleAssert = require("truffle-assertions");

const advance = require("./helper/advance");
const time = require("./helper/time");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchVestingV2 = artifacts.require("CrunchVestingV2");
const CrunchVestingV2Factory = artifacts.require("CrunchVestingV2Factory");

contract("Crunch Vesting Factory", async (accounts) => {
  let crunch;
  let factory;

  const [owner, beneficiary] = accounts;
  const fromBeneficiary = {
    from: beneficiary,
  };

  const vestingAt = async (tx) => {
    let vesting;
    await truffleAssert.eventEmitted(await tx, "Created", (event) => {
      vesting = CrunchVestingV2.at(event.vesting);
      return true;
    });

    await expect(vesting).to.not.be.null;

    return vesting;
  };

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    factory = await CrunchVestingV2Factory.new(crunch.address);
  });

  it("create()", async () => {
    const cliffDuration = 60;
    const duration = 600;
    const revokable = true;

    const vesting = await vestingAt(
      factory.create(beneficiary, cliffDuration, duration, revokable)
    );

    await expect(vesting.beneficiary()).to.eventually.be.equal(beneficiary);
    await expect(vesting.duration()).to.eventually.be.a.bignumber.equal(
      new BN(duration)
    );
    await expect(vesting.revokable()).to.eventually.be.equal(revokable);
    await expect(vesting.owner()).to.eventually.be.equal(owner);
  });

  it("emptyReserve()", async () => {
    await expect(factory.emptyReserve()).to.be.rejectedWith(
      Error,
      "Vesting Factory: reserve is already empty"
    );

    await crunch.transfer(factory.address, 100);

    await expect(factory.emptyReserve(fromBeneficiary)).to.be.rejectedWith(
      Error,
      "Ownable: caller is not the owner"
    );

    await expect(factory.emptyReserve()).to.be.fulfilled;

    await expect(
      crunch.balanceOf(factory.address)
    ).to.eventually.be.a.bignumber.equal(new BN(0));
  });

  it("vesting.revoke() : revokable", async () => {
    const cliffDuration = 60;
    const duration = 600;
    const revokable = true;

    const vesting = await vestingAt(
      factory.create(beneficiary, cliffDuration, duration, revokable)
    );

    await expect(vesting.revoke()).to.be.fulfilled;
    await expect(factory.emptyReserve()).to.be.rejected;
  });

  it("vesting.revoke() : not revokable", async () => {
    const cliffDuration = 60;
    const duration = 600;
    const revokable = false;

    const vesting = await vestingAt(
      factory.create(beneficiary, cliffDuration, duration, revokable)
    );

    await expect(vesting.revoke()).to.be.rejected;
  });
});
