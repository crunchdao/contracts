const CrunchToken = artifacts.require("CrunchToken");
const CrunchMultiVestingV2 = artifacts.require("CrunchMultiVestingV2");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchMultiVestingV2, CrunchToken.address);
};
