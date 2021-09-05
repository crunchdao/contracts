const CrunchToken = artifacts.require("CrunchToken");
const CrunchAirdrop = artifacts.require("CrunchAirdrop");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchAirdrop, CrunchToken.address);
};
