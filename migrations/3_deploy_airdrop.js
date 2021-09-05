const CrunchToken = artifacts.require("CrunchToken");
const CrunchAirdrop = artifacts.require("CrunchAirdrop");

module.exports = async (deployer) => {
  const crunch = await CrunchToken.deployed();

  await deployer.deploy(CrunchAirdrop, crunch.address);
};
