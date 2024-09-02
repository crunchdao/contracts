# CRUNCH DAO CONTRACTS

[![Truffle Build](https://github.com/datacrunch-com/datacrunch-contracts/actions/workflows/truffle.yml/badge.svg)](https://github.com/datacrunch-com/datacrunch-contracts/actions/workflows/truffle.yml)

## $CRUNCH Token

Main $CRUNCH Token.

| Resource | File |
| --- | --- |
| Source Code | [contracts/CrunchToken.sol](contracts/CrunchToken.sol) |

| Network | Address | Transaction |
| --- | --- | --- |
| mainnet | [`0x74451d2240ef9e86b3cea815378af61566b81856`](https://etherscan.io/address/0x74451d2240ef9e86b3cea815378af61566b81856) | |
| ropsten | [`0x92735e05BfD70e266b8A727DD47e483803904fe4`](https://ropsten.etherscan.io/address/0x92735e05BfD70e266b8A727DD47e483803904fe4) | [deploy](https://ropsten.etherscan.io/tx/0xfafb18e4263f38542f9fe9b3a5326d92eaaa2425f36f4fdba1f9be1ea76d7258) |
| goerli | [`0x9376bA3841F0E6A77F5CDc479CdfC84F6203b776`](https://goerli.etherscan.io/address/0x9376bA3841F0E6A77F5CDc479CdfC84F6203b776) | [deploy](https://goerli.etherscan.io/tx/0xb6f8ca04a8d219a83e61c28ce5afa9714235b456e3061f8f666a8c32800cbd34) |
| sepolia | [`0x69a2515dd75f4a7500ff04455080000400bc98da`](https://sepolia.etherscan.io/address/0x69a2515dd75f4a7500ff04455080000400bc98da) | [deploy](https://sepolia.etherscan.io/tx/0xc47040f83cd87b4f528e675872bf8f54e9ca91326d3635c9564b4fd67d75b965) |

## Reward (aka. Payouts)

Contract used for paying data-scientists every months.

| Resource | File |
| --- | --- |
| Source Code | [contracts/CrunchReward.sol](contracts/CrunchReward.sol) |
| Tests | [test/CrunchReward.test.js](test/CrunchReward.test.js) |

| Network | Address |
| --- | --- |
| mainnet | [`0xa3b20d15649b03f38ab71d64f0f5fcb3ac48c3f4`](https://etherscan.io/address/0xa3b20d15649b03f38ab71d64f0f5fcb3ac48c3f4) | |
| ropsten | [`0x023761FBd53b1fB8f0B110AfCdB5C8AC512C64B4`](https://ropsten.etherscan.io/address/0x023761FBd53b1fB8f0B110AfCdB5C8AC512C64B4) | [deploy](https://ropsten.etherscan.io/tx/0xd5e15eb4e2b8f804754c4483ea5b70245e9c1e0c6a8cb05c42ffbb3e17998863) |
| goerli | [`0xf81532714383e17AB9BFF4be46FFE701E6B32980`](https://goerli.etherscan.io/address/0xf81532714383e17AB9BFF4be46FFE701E6B32980) | [deploy](https://goerli.etherscan.io/tx/0x0fbe96231c90e143e676d45ddf026c91cffda76ba278045c6ef4b3d21b4a6d61) |
| sepolia | [`0x4dc0bfe0017b616ad3a8752fb769eee75f8164f5`](https://sepolia.etherscan.io/address/0x4dc0bfe0017b616ad3a8752fb769eee75f8164f5) | [deploy](https://sepolia.etherscan.io/tx/0x22f6302ed4ff6db31c3c1841fb732dad369c1fc25e3ce4e607d69db91386e9ff) |

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
