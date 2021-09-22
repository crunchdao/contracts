const CrunchToken = artifacts.require("CrunchToken");
const CrunchStaking = artifacts.require("CrunchStaking");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchStaking, CrunchToken.address, 734);
};
