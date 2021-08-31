const CrunchToken = artifacts.require("CrunchToken");
const Stakeholding = artifacts.require("Stakeholding");
const CrunchStaking = artifacts.require("CrunchStaking");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchToken);
  await deployer.deploy(Stakeholding)
  await deployer.link(Stakeholding, [CrunchStaking])
  await deployer.deploy(CrunchStaking, CrunchToken.address, 657 /* see yield doc */);
};
