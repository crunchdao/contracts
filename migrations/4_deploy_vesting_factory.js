const CrunchToken = artifacts.require("CrunchToken");
const CrunchVestingFactory = artifacts.require("CrunchVestingFactory");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchVestingFactory, CrunchToken.address);
};
