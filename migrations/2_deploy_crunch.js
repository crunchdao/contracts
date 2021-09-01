const CrunchToken = artifacts.require("CrunchToken");

module.exports = async (deployer) => {
  await deployer.deploy(CrunchToken);
};
