const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");
const time = require("./helper/time");

const CrunchToken = artifacts.require("CrunchToken");
const VCrunchToken = artifacts.require("VCrunchToken");
const CrunchMultiVesting = artifacts.require("CrunchMultiVesting");
const CrunchVesting = artifacts.require("CrunchVesting");
const CrunchVestingV2 = artifacts.require("CrunchVestingV2");

const NULL = "0x0000000000000000000000000000000000000000";
const ZERO = new BN("0");
const ONE = new BN("1");
const TWO = new BN("2");

contract("vCRUNCH Token", async (accounts) => {
  let crunch;
  let vCrunch;

  const [owner, beneficiary, user] = accounts;

  const fromBeneficiary = {
    from: beneficiary,
  };

  const fromUser = {
    from: user,
  };

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    vCrunch = await VCrunchToken.new(crunch.address);
  });

  it("owner()", async () => {
    await expect(vCrunch.owner()).to.eventually.be.equal(owner);
  });

  it("crunch()", async () => {
    await expect(vCrunch.crunch()).to.eventually.be.equal(crunch.address);
  });

  it("addBalanceOf(address, address) : vesting", async () => {
    const amount = new BN(100);
    const cliff = time.days(1);
    const duration = time.days(10);

    const vesting = await CrunchVesting.new(
      crunch.address,
      NULL /* override owner */,
      beneficiary,
      cliff,
      duration,
      false /* revokable */
    );

    const target = vesting.address;
    const index = ZERO;

    await await expect(
      vCrunch.addBalanceOf(beneficiary, target, fromUser)
    ).to.be.rejectedWith(Error, "Ownable: caller is not the owner");

    await await expect(vCrunch.addBalanceOf(beneficiary, target)).to.be
      .fulfilled;

    await expect(vCrunch.balanceOfs(beneficiary, index)).to.eventually.be.equal(
      target
    );

    await expect(
      vCrunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(crunch.transfer(vesting.address, amount)).to.be.fulfilled;

    await expect(
      vCrunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(amount);

    await advance.timeAndBlock(time.days(5));

    await expect(vesting.release(fromBeneficiary)).to.be.fulfilled;

    await expect(
      vCrunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(amount.divn(2));

    await advance.timeAndBlock(time.days(5));

    await expect(vesting.release(fromBeneficiary)).to.be.fulfilled;

    await expect(
      vCrunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);
  });

  it("addMultiple(address, string calldata) : multi-vesting", async () => {
    const amount = new BN(100);

    const multiVesting = await CrunchMultiVesting.new(crunch.address);
    await expect(crunch.transfer(multiVesting.address, amount)).to.be.fulfilled;

    const target = multiVesting.address;
    const signature = "balanceOf(address)";
    const index = ZERO;

    await await expect(
      vCrunch.addMultiple(target, signature, fromUser)
    ).to.be.rejectedWith(Error, "Ownable: caller is not the owner");

    await expect(vCrunch.addMultiple(target, signature)).to.be.fulfilled;

    await expect(vCrunch.multiples(index))
      .to.eventually.have.property("target")
      .and.equal(target);

    await expect(vCrunch.multiples(index))
      .to.eventually.have.property("signature")
      .and.equal(signature);

    await expect(
      vCrunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);

    await expect(
      multiVesting.create(beneficiary, amount, time.days(1), time.days(10))
    ).to.be.fulfilled;

    await expect(
      vCrunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(amount);

    await advance.timeAndBlock(time.days(5));

    await expect(multiVesting.releaseAllFor(beneficiary)).to.be.fulfilled;

    await expect(
      vCrunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(amount.divn(2));

    await advance.timeAndBlock(time.days(5));

    await expect(multiVesting.releaseAllFor(beneficiary)).to.be.fulfilled;

    await expect(
      vCrunch.balanceOf(beneficiary)
    ).to.eventually.be.a.bignumber.equal(ZERO);
  });
});
