const CrunchToken = artifacts.require("CrunchToken");
const CrunchStacking = artifacts.require("CrunchStacking");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchToken);
  await deployer.deploy(CrunchStacking, CrunchToken.address, 1);
};
