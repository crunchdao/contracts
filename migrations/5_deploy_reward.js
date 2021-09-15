const CrunchToken = artifacts.require("CrunchToken");
const CrunchReward = artifacts.require("CrunchReward");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchReward, CrunchToken.address);
};
