const CrunchToken = artifacts.require("CrunchToken");
const CrunchStaking = artifacts.require("CrunchStaking");
const CrunchStakingRewardViewer = artifacts.require("CrunchStakingRewardViewer");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchStakingRewardViewer, CrunchToken.address, CrunchStaking.address);
};
