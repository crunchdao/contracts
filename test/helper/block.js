const latest = async () => {
  return Promise.resolve(web3.eth.getBlock("latest"));
};

module.exports = { latest };
