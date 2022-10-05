# CRUNCH DAO CONTRACTS

[![Truffle Build](https://github.com/datacrunch-com/datacrunch-contracts/actions/workflows/truffle.yml/badge.svg)](https://github.com/datacrunch-com/datacrunch-contracts/actions/workflows/truffle.yml)

## $CRUNCH Token

Main $CRUNCH Token.

| Resource | File |
| --- | --- |
| Source Code | [contracts/CrunchToken.sol](contracts/CrunchToken.sol) |

| Network | Address |
| --- | --- |
| mainnet | [0x74451d2240ef9e86b3cea815378af61566b81856](https://etherscan.io/address/0x74451d2240ef9e86b3cea815378af61566b81856) |

## Reward (aka. Payouts)

Contract used for paying data-scientists every months.

| Resource | File |
| --- | --- |
| Source Code | [contracts/CrunchReward.sol](contracts/CrunchReward.sol) |
| Tests | [test/CrunchReward.test.js](test/CrunchReward.test.js) |

| Network | Address |
| --- | --- |
| mainnet | [0xa3b20d15649b03f38ab71d64f0f5fcb3ac48c3f4](https://etherscan.io/address/0xa3b20d15649b03f38ab71d64f0f5fcb3ac48c3f4) |

## Staking

Contract allowing anyone to stake some $CRUNCHs.

| Resource | File |
| --- | --- |
| Source Code | [contracts/CrunchStaking.sol](contracts/CrunchStaking.sol) |
| Tests | [test/CrunchStaking.test.js](test/CrunchStaking.test.js) |
| Stress Tests | [test/CrunchStaking.stress.test.js](test/CrunchStaking.stress.test.js) |

| Network | Address |
| --- | --- |
| mainnet | [0x74451d2240ef9e86b3cea815378af61566b81856](https://etherscan.io/address/0x74451d2240ef9e86b3cea815378af61566b81856) |

## Selling

Instant sell of you $CRUNCHs directly by CRUNCH DAO.

| Resource | File |
| --- | --- |
| Source Code | [contracts/CrunchSelling.sol](contracts/CrunchSelling.sol) |
| Tests | [test/CrunchSelling.test.js](test/CrunchSelling.test.js) |

| Network | Address |
| --- | --- |
| mainnet | [0x22525935cb0f5c27ae025fe5a403bc7a0eb9c857](https://etherscan.io/address/0x22525935cb0f5c27ae025fe5a403bc7a0eb9c857) |

## Multi-Vesting

### v1

Shared vesting contract allowing multiple users.

| Resource | File |
| --- | --- |
|  Source Code | [contracts/CrunchMultiVesting.sol](contracts/CrunchMultiVesting.sol) |
| Tests | [test/CrunchMultiVesting.test.js](test/CrunchMultiVesting.test.js) |
| Stress Tests | [test/CrunchMultiVesting.stress.test.js](test/CrunchMultiVesting.stress.test.js) |

| Network | Address |
| --- | --- |
| mainnet | [0xe469f12f4746b5ae105a1b888bff5a1b9e27fee5](https://etherscan.io/address/0xe469f12f4746b5ae105a1b888bff5a1b9e27fee5) |

### v2

Shared vesting contract allowing multiple users but extra features like revocation and transferability.

| Resource | File |
| --- | --- |
| Source Code | [contracts/CrunchMultiVestingV2.sol](contracts/CrunchMultiVestingV2.sol) |
| Tests | [test/CrunchMultiVestingV2.test.js](test/CrunchMultiVestingV2.test.js) |
| Stress Tests | [test/CrunchMultiVestingV2.stress.test.js](test/CrunchMultiVestingV2.stress.test.js) |

| Network | Address |
| --- | --- |
| mainnet | [0xf3b262b8623aa8eaf302bd46a393179df0ed13c5](https://etherscan.io/address/0xf3b262b8623aa8eaf302bd46a393179df0ed13c5) |
