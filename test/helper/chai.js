// from: https://github.com/OpenZeppelin/openzeppelin-test-helpers/blob/master/src/setup.js

const chai = require("chai");
chai.config.truncateThreshold = 0;

const BN = web3.utils.BN;
const chaiBN = require("chai-bn")(BN);

chai.use(chaiBN);
chai.use(require('chai-as-promised'));

module.exports = {
  chai,
  expect: chai.expect,
  BN,
};
