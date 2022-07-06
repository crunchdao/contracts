const truffleAssert = require("truffle-assertions");

const advance = require("./helper/advance");
const time = require("./helper/time");
const block = require("./helper/block");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchTimelock = artifacts.require("CrunchTimelock");
const CrunchTimelockFactory = artifacts.require("CrunchTimelockFactory");

contract("Crunch Timelock Factory", async (accounts) => {
  let crunch;
  let factory;

  const [owner, beneficiary] = accounts;

  const timelockAt = async (tx) => {
    let timelock;
    await truffleAssert.eventEmitted(await tx, "Created", (event) => {
      timelock = CrunchTimelock.at(event.timelock);
      return true;
    });

    await expect(timelock).to.not.be.null;

    return timelock;
  };

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    factory = await CrunchTimelockFactory.new(crunch.address);
  });

  it("oneYear()", async () => {
    await expect(factory.oneYear()).to.eventually.be.a.bignumber.equal(
      new BN(time.oneYear)
    );
  });

  it("create(address, uint256)", async () => {
    const releaseDuration = 60;

    const timelock = await timelockAt(
      factory.create(beneficiary, releaseDuration)
    );

    const { timestamp } = await block.latest();

    await expect(timelock.beneficiary()).to.eventually.be.equal(beneficiary);
    await expect(timelock.releaseTime()).to.eventually.be.a.bignumber.equal(
      new BN(timestamp + releaseDuration)
    );
  });

  it("createSimple(address)", async () => {
    const timelock = await timelockAt(factory.createSimple(beneficiary));

    const { timestamp } = await block.latest();

    await expect(timelock.beneficiary()).to.eventually.be.equal(beneficiary);
    await expect(timelock.releaseTime()).to.eventually.be.a.bignumber.equal(
      new BN(timestamp + time.oneYear)
    );
  });

  it("transferToOwner()", async () => {
    await expect(factory.transferToOwner()).to.be.rejected;

    await crunch.transfer(factory.address, 100);

    await expect(factory.transferToOwner()).to.be.fulfilled;
  });

  it("timelock.release() : no token", async () => {
    const releaseDuration = 60;

    const timelock = await timelockAt(
      factory.create(beneficiary, releaseDuration)
    );

    await expect(timelock.release()).to.be.rejected;

    await advance.time(releaseDuration);

    await expect(timelock.release()).to.be.rejected;
  });

  it("timelock.release() : with token", async () => {
    const releaseDuration = 60;
    const amount = 1000;

    const timelock = await timelockAt(
      factory.create(beneficiary, releaseDuration)
    );

    await expect(crunch.transfer(timelock.address, amount)).to.be.fulfilled;

    await advance.time(releaseDuration);

    await expect(timelock.release()).to.be.fulfilled;

    await expect(
      crunch.balanceOf(timelock.address)
    ).to.eventually.be.a.bignumber.equal(new BN(0));

    await expect(
      crunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(new BN(amount));
  });
});
