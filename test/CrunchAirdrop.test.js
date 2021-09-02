const advance = require("./helper/advance");
const { expect, BN } = require("./helper/chai");

const CrunchToken = artifacts.require("CrunchToken");
const CrunchAirdrop = artifacts.require("CrunchAirdrop");

contract("Crunch Airdrop", async (accounts) => {
  let crunch;
  let airdrop;

  beforeEach(async () => {
    crunch = await CrunchToken.new();
    airdrop = await CrunchAirdrop.new(crunch.address);
  });

  it("distribute(address[] memory, uint256[] memory) : empty values", async () => {
    const reserve = 100;

    await crunch.transfer(airdrop.address, reserve);

    await expect(airdrop.distribute([], [])).to.be.rejected;
    await expect(airdrop.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve)
    );
  });

  it("distribute(address[] memory, uint256[] memory) : not enough balance", async () => {
    const reserve = 100;

    await crunch.transfer(airdrop.address, reserve);

    const recipients = [accounts[1], accounts[2]];
    const values = [reserve, reserve];

    await expect(airdrop.distribute(recipients, values)).to.be.rejected;
    await expect(airdrop.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve)
    );
  });

  it("distribute(address[] memory, uint256[] memory) : 2 recipients, 1 value", async () => {
    const reserve = 100;

    await crunch.transfer(airdrop.address, reserve);

    const recipients = [accounts[1], accounts[2]];
    const values = [10];

    await expect(airdrop.distribute(recipients, values)).to.be.rejected;
    await expect(airdrop.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve)
    );
  });

  it("distribute(address[] memory, uint256[] memory) : ([0x1, 0x2], [10, 10])", async () => {
    const reserve = 100;

    await crunch.transfer(airdrop.address, 100);

    const recipients = [accounts[1], accounts[2]];
    const values = [10, 10];

    await expect(airdrop.distribute(recipients, values)).to.be.fulfilled;
    await expect(airdrop.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(reserve - values.reduce((a, b) => a + b, 0))
    );
  });

  it("distribute(address[] memory, uint256[] memory) : everything", async () => {
    const reserve = 100;

    await crunch.transfer(airdrop.address, 100);

    const recipients = [accounts[1], accounts[2]];
    const values = [reserve / 2, reserve / 2];

    await expect(airdrop.distribute(recipients, values)).to.be.fulfilled;
    await expect(airdrop.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("empty() : when already empty", async () => {
    await expect(airdrop.empty()).to.be.rejected;
  });

  it("empty() : when have remaining", async () => {
    await crunch.transfer(airdrop.address, 100);

    await expect(airdrop.empty()).to.be.fulfilled;
    await expect(airdrop.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("reserve() : when empty", async () => {
    await expect(airdrop.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(0)
    );
  });

  it("reserve() : when have some", async () => {
    await crunch.transfer(airdrop.address, 100);

    await expect(airdrop.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(100)
    );

    await crunch.transfer(airdrop.address, 200);

    await expect(airdrop.reserve()).to.eventually.be.a.bignumber.equal(
      new BN(300)
    );
  });

  it("destroy() : when empty", async () => {
    await airdrop.destroy();

    await expect(airdrop.reserve()).to.be.rejected; /* test if killed */
    await expect(
      crunch.balanceOf(airdrop.address)
    ).to.eventually.be.a.bignumber.equal(new BN(0));
  });

  it("destroy() : when have some", async () => {
    const reserve = 100;

    await crunch.transfer(airdrop.address, reserve);

    await airdrop.destroy();

    await expect(airdrop.reserve()).to.be.rejected; /* test if killed */
    await expect(
      await crunch.balanceOf(airdrop.address)
    ).to.be.a.bignumber.equal(new BN(0));
    await expect(await crunch.balanceOf(accounts[0])).to.be.a.bignumber.equal(
      await crunch.totalSupply()
    );
  });
});
