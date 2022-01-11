const CrunchToken = artifacts.require("CrunchToken");
const CrunchSelling = artifacts.require("CrunchSelling");
const USDCoin = artifacts.require("USDCoin");

const initialPrice = web3.utils.toWei("2.4");

async function getUSDCAddress(deployer, networkId) {
  if (networkId == 1) {
    return "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  }

  await deployer.deploy(USDCoin);
  return USDCoin.address;
}

module.exports = async (deployer) => {
  const networkId = await web3.eth.net.getId();

  const usdcAddress = await getUSDCAddress(deployer, networkId);

  await deployer.deploy(
    CrunchSelling,
    CrunchToken.address,
    usdcAddress,
    initialPrice
  );
};
