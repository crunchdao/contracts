// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./erc677/IERC677Receiver.sol";

contract CrunchSelling is Ownable, Pausable, IERC677Receiver {
    /** @dev Emitted when the crunch address is changed. */
    event CrunchChanged(
        address indexed previousCrunch,
        address indexed newCrunch
    );

    /** @dev Emitted when the usdc address is changed. */
    event UsdcChanged(address indexed previousUsdc, address indexed newUsdc);

    /** @dev Emitted when the price is changed. */
    event PriceChanged(uint256 previousPrice, uint256 newPrice);

    /** @dev Emitted when `addr` sold $CRUNCHs for $USDCs. */
    event Sell(
        address indexed addr,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 price
    );

    /** @dev CRUNCH erc20 address. */
    IERC20Metadata public crunch;

    /** @dev USDC erc20 address. */
    IERC20 public usdc;

    /** @dev How much USDC must be exchanged for 1 CRUNCH. */
    uint256 public price;

    /** @dev Cached value of 1 CRUNCH (1**18). */
    uint256 public oneCrunch;

    constructor(
        address _crunch,
        address _usdc,
        uint256 initialPrice
    ) {
        setCrunch(_crunch);
        setUsdc(_usdc);
        setPrice(initialPrice);
    }

    /**
     * Sell `amount` CRUNCH to USDC.
     *
     * Emits a {Sell} event.
     *
     * Requirements:
     * - caller's CRUNCH allowance is greater or equal to `amount`.
     * - caller's CRUNCH balance is greater or equal to `amount`.
     * - the contract must not be paused.
     * - caller is not the owner.
     * - `amount` is not zero.
     * - the reserve has enough USDC after conversion.
     *
     * @dev the implementation use a {IERC20-transferFrom(address, address, uint256)} call to transfer the CRUNCH from the caller to the owner.
     *
     * @param amount CRUNCH amount to sell.
     */
    function sell(uint256 amount) public whenNotPaused {
        address seller = _msgSender();

        require(
            crunch.allowance(seller, address(this)) >= amount,
            "Selling: user's allowance is not enough"
        );
        require(
            crunch.balanceOf(seller) >= amount,
            "Selling: user's balance is not enough"
        );

        crunch.transferFrom(seller, owner(), amount);

        _sell(seller, amount);
    }

    /**
     * Sell `amount` CRUNCH to USDC from a `transferAndCall`, avoiding the usage of an `approve` call.
     *
     * Emits a {Sell} event.
     *
     * Requirements:
     * - caller must be the crunch token.
     * - the contract must not be paused.
     * - `sender` is not the owner.
     * - `amount` is not zero.
     * - the reserve has enough USDC after conversion.
     *
     * @dev the implementation use a {IERC20-transfer(address, uint256)} call to transfer the received CRUNCH to the owner.
     */
    function onTokenTransfer(
        address sender,
        uint256 value,
        bytes memory data
    ) external override onlyCrunch whenNotPaused {
        data; /* silence unused */

        crunch.transfer(owner(), value);

        _sell(sender, value);
    }

    /**
     * Internal selling function.
     *
     * Emits a {Sell} event.
     *
     * Requirements:
     * - `seller` is not the owner.
     * - `amount` is not zero.
     * - the reserve has enough USDC after conversion.
     *
     * @param seller seller address.
     * @param amount CRUNCH amount to sell.
     */
    function _sell(address seller, uint256 amount) internal {
        require(seller != owner(), "Selling: owner cannot sell");
        require(amount != 0, "Selling: cannot sell 0 unit");

        uint256 tokens = conversion(amount);
        require(tokens != 0, "Selling: selling will result in getting nothing");
        require(reserve() >= tokens, "Selling: reserve is not big enough");

        usdc.transfer(seller, tokens);

        emit Sell(seller, amount, tokens, price);
    }

    /**
     * @dev convert a value in CRUNCH to USDC using the current price.
     *
     * @param inputAmount input value to convert.
     * @return outputAmount the converted amount.
     */
    function conversion(uint256 inputAmount)
        public
        view
        returns (uint256 outputAmount)
    {
        return (inputAmount * price) / oneCrunch;
    }

    /** @return the USDC balance of the contract. */
    function reserve() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * Empty the USDC reserve.
     *
     * Requirements:
     * - caller must be the owner.
     */
    function emptyReserve() public onlyOwner {
        bool success = _emptyReserve();

        require(success, "Selling: reserve already empty");
    }

    /**
     * Empty the USDC reserve.
     *
     * Requirements:
     * - caller must be the owner.
     */
    function returnCrunchs() public onlyOwner {
        bool success = _returnCrunchs();

        require(success, "Selling: no crunch");
    }

    /**
     * Pause the contract.
     *
     * Requirements:
     * - caller must be the owner.
     * - contract must not already be paused.
     */
    function pause()
        external
        onlyOwner /* whenNotPaused */
    {
        _pause();
    }

    /**
     * Unpause the contract.
     *
     * Requirements:
     * - caller must be the owner.
     * - contract must be already paused.
     */
    function unpause()
        external
        onlyOwner /* whenPaused */
    {
        _unpause();
    }

    /**
     * Update the CRUNCH token address.
     *
     * Emits a {CrunchChanged} event.
     *
     * Requirements:
     * - caller must be the owner.
     *
     * @dev this will update the `oneCrunch` value.
     *
     * @param newCrunch new CRUNCH address.
     */
    function setCrunch(address newCrunch) public onlyOwner {
        address previous = address(crunch);

        crunch = IERC20Metadata(newCrunch);
        oneCrunch = 10**crunch.decimals();

        emit CrunchChanged(previous, newCrunch);
    }

    /**
     * Update the USDC token address.
     *
     * Emits a {UsdcChanged} event.
     *
     * Requirements:
     * - caller must be the owner.
     *
     * @param newUsdc new USDC address.
     */
    function setUsdc(address newUsdc) public onlyOwner {
        address previous = address(usdc);

        usdc = IERC20(newUsdc);

        emit UsdcChanged(previous, newUsdc);
    }

    /**
     * Update the price.
     *
     * Emits a {PriceChanged} event.
     *
     * Requirements:
     * - caller must be the owner.
     *
     * @param newPrice new price value.
     */
    function setPrice(uint256 newPrice) public onlyOwner {
        uint256 previous = price;

        price = newPrice;

        emit PriceChanged(previous, newPrice);
    }

    /**
     * Destroy the contract.
     * This will send the tokens (CRUNCH and USDC) back to the owner.
     *
     * Requirements:
     * - caller must be the owner.
     */
    function destroy() external onlyOwner {
        _emptyReserve();
        _returnCrunchs();

        selfdestruct(payable(owner()));
    }

    /**
     * Empty the reserve.
     *
     * @return true if at least 1 USDC has been transfered, false otherwise.
     */
    function _emptyReserve() internal returns (bool) {
        uint256 amount = reserve();

        if (amount != 0) {
            usdc.transfer(owner(), amount);
            return true;
        }

        return false;
    }

    /**
     * Return the CRUNCHs.
     *
     * @return true if at least 1 CRUNCH has been transfered, false otherwise.
     */
    function _returnCrunchs() internal returns (bool) {
        uint256 amount = crunch.balanceOf(address(this));

        if (amount != 0) {
            crunch.transfer(owner(), amount);
            return true;
        }

        return false;
    }

    modifier onlyCrunch() {
        require(
            address(crunch) == _msgSender(),
            "Selling: caller must be the crunch token"
        );
        _;
    }
}
