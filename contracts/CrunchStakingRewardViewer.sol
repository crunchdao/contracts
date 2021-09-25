// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ICrunchStakingView {
    function totalStakedOf(address addr) external view returns (uint256);

    function totalRewardOf(address addr) external view returns (uint256);
}

/**
 * A simple viewer contract to enable direct reward view directly from MetaMask using a shell ERC20-compatible contract.
 *
 * @author Enzo CACERES
 */
contract CrunchStakingRewardViewer is IERC20, IERC20Metadata, Ownable {
    event CrunchUpdated(address indexed to);
    event StakingUpdated(address indexed to);

    /** CRUNCH token contract. */
    IERC20Metadata public crunch;

    /** staking contract */
    ICrunchStakingView public staking;

    constructor(IERC20Metadata _crunch, ICrunchStakingView _staking) {
        setCrunch(_crunch);
        setStaking(_staking);

        /* make etherscan detect this contract as an ERC20 token */
        emit Transfer(address(0), address(0), 0);
    }

    /** @dev see {IERC20Metadata-name()} */
    function name() external pure override returns (string memory) {
        return "Crunch Staking Token";
    }

    /** @dev see {IERC20Metadata-symbol()} */
    function symbol() external pure override returns (string memory) {
        return "sCRUNCH";
    }

    /** @dev see {IERC20-decimals()} */
    function decimals() external view override returns (uint8) {
        return crunch.decimals();
    }

    /**
     * @dev see {IERC20Metadata-totalSupply()}
     *
     * @return the current staking's contract balance in CRUNCH.
     */
    function totalSupply() external view override returns (uint256) {
        return crunch.balanceOf(address(staking));
    }

    /**
     * @dev see {IERC20Metadata-balanceOf(address)}
     *
     * @return the currently staking + reward amount of an address.
     */
    function balanceOf(address account)
        external
        view
        override
        returns (uint256)
    {
        uint256 staked = staking.totalStakedOf(account);
        uint256 reward = staking.totalRewardOf(account);

        return staked + reward;
    }

    /**
     * @dev see {IERC20Metadata-transfer(address, uint256)}
     * @dev this function has been disabled.
     */
    function transfer(address, uint256)
        external
        override
        disabled
        returns (bool)
    {}

    /**
     * @dev see {IERC20Metadata-allowance(address, address)}
     * @dev this function has been disabled.
     */
    function allowance(address, address)
        external
        pure
        override
        disabled
        returns (uint256)
    {}

    /**
     * @dev see {IERC20Metadata-approve(address, uint256)}
     * @dev this function has been disabled.
     */
    function approve(address, uint256)
        external
        override
        disabled
        returns (bool)
    {}

    /**
     * @dev see {IERC20Metadata-transferFrom(address, address, uint256)}
     * @dev this function has been disabled.
     */
    function transferFrom(
        address,
        address,
        uint256
    ) external override disabled returns (bool) {}

    /**
     * Update the CRUNCH token contract address.
     *
     * @dev Emit a `CrunchUpdated` event.
     * @dev New address must not be `address(0)`
     *
     * @param _crunch new CRUNCH token contract address.
     */
    function setCrunch(IERC20Metadata _crunch) public onlyOwner {
        require(
            address(_crunch) != address(0),
            "crunch token contract must not be zero"
        );

        crunch = _crunch;

        emit CrunchUpdated(address(crunch));
    }

    /**
     * Update the staking contract address.
     *
     * @dev Emit a `StakingUpdated` event.
     * @dev New address must not be `address(0)`
     *
     * @param _staking new staking contract address.
     */
    function setStaking(ICrunchStakingView _staking) public onlyOwner {
        require(
            address(_staking) != address(0),
            "staking contract must not be zero"
        );

        staking = _staking;

        emit StakingUpdated(address(staking));
    }

    modifier disabled() {
        _;
        revert("not callable");
    }
}
