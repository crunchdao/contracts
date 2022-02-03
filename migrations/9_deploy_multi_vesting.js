const CrunchToken = artifacts.require("CrunchToken");
const CrunchMultiVesting = artifacts.require("CrunchMultiVesting");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchMultiVesting, CrunchToken.address);
};
