const time = (seconds) => {
  if (web3.utils.isBN(seconds)) {
    seconds = seconds.toNumber()
  }

  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [seconds],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

const block = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime(),
      },
      async (err, result) => {
        if (err) {
          return reject(err);
        }

        try {
          const newBlock = await web3.eth.getBlock("latest");
          return resolve(newBlock);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};

const timeAndBlock = async (seconds) => {
  await time(seconds);
  return await block();
};

module.exports = { time, block, timeAndBlock };
