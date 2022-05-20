const latest = async () => {
  return Promise.resolve(web3.eth.getBlock("latest"));
};

const get = async (number) => {
  return Promise.resolve(web3.eth.getBlock(number));
};

module.exports = { latest, get };
