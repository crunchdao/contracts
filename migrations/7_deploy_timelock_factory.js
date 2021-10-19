const CrunchToken = artifacts.require("CrunchToken");
const CrunchTimelockFactory = artifacts.require("CrunchTimelockFactory");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchTimelockFactory, CrunchToken.address);
};
