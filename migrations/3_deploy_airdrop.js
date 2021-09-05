const CrunchAirdrop = artifacts.require("CrunchAirdrop");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchAirdrop);
};
