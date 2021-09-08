const truffleAssert = require("truffle-assertions");

const advance = require("./helper/advance");
const time = require("./helper/time");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchVesting = artifacts.require("CrunchVesting");
const CrunchVestingFactory = artifacts.require("CrunchVestingFactory");

contract("Crunch Vesting Factory", async (accounts) => {
  let crunch;
  let factory;

  const [owner, beneficiary] = accounts;

  const vestingAt = async (tx) => {
    let vesting;
    await truffleAssert.eventEmitted(await tx, "Created", (event) => {
      vesting = CrunchVesting.at(event.vesting);
      return true;
    });

    await expect(vesting).to.not.be.null;

    return vesting;
  };

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    factory = await CrunchVestingFactory.new(crunch.address);
  });

  it("oneYear()", async () => {
    await expect(factory.oneYear()).to.eventually.be.a.bignumber.equal(
      new BN(time.oneYear)
    );
  });

  it("create()", async () => {
    const cliffDuration = 60;
    const duration = 600;

    const vesting = await vestingAt(
      factory.create(beneficiary, cliffDuration, duration)
    );

    await expect(vesting.beneficiary()).to.eventually.be.equal(beneficiary);
    await expect(vesting.duration()).to.eventually.be.a.bignumber.equal(
      new BN(duration)
    );
    await expect(vesting.owner()).to.eventually.be.equal(
      owner
    ); /* should not be the factory */
  });

  it("createSimple()", async () => {
    const vesting = await vestingAt(factory.createSimple(beneficiary));

    await expect(vesting.beneficiary()).to.eventually.be.equal(beneficiary);
    await expect(vesting.duration()).to.eventually.be.a.bignumber.equal(
      new BN(time.years(4))
    );
  });

  it("transferToOwner()", async () => {
    await expect(factory.transferToOwner()).to.be.rejected;

    await crunch.transfer(factory.address, 100);

    await expect(factory.transferToOwner()).to.be.fulfilled;
  });

  it("vesting.revoke()", async () => {
    const cliffDuration = 60;
    const duration = 600;

    const vesting = await vestingAt(
      factory.create(beneficiary, cliffDuration, duration)
    );

    await expect(vesting.revoke()).to.be.fulfilled;
    await expect(factory.transferToOwner()).to.be.rejected;
  });
});
