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

    function onTokenTransfer(
        address sender,
        uint256 value,
        bytes memory data
    ) external override onlyCrunch whenNotPaused {
        data; /* silence unused */

        _sell(sender, value);
    }

    function _sell(address seller, uint256 amount) internal {
        require(seller != owner(), "Selling: owner cannot sell");
        require(amount != 0, "Selling: cannot sell 0 unit");

        uint256 tokens = conversion(amount);
        require(
            tokens != 0,
            "Selling: selling will result in getting nothing in return"
        );
        require(reserve() >= tokens, "Selling: usdc reserve is not big enough");

        usdc.transfer(seller, tokens);

        emit Sell(seller, amount, tokens, price);
    }

    function conversion(uint256 inputAmount) public view returns (uint256 outputAmount) {
        return (inputAmount * price) / oneCrunch;
    }

    function reserve() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function emptyReserve() public onlyOwner {
        uint256 amount = reserve();

        require(amount != 0, "Selling: reserve already empty");

        usdc.transfer(owner(), amount);
    }

    function returnCrunchs() public onlyOwner {
        uint256 amount = crunch.balanceOf(address(this));

        require(amount != 0, "Selling: no crunch");

        crunch.transfer(owner(), amount);
    }

    function pause()
        external
        onlyOwner /* whenNotPaused */
    {
        _pause();
    }

    function unpause()
        external
        onlyOwner /* whenPaused */
    {
        _unpause();
    }

    function setCrunch(address newCrunch) public onlyOwner {
        address previous = address(crunch);

        crunch = IERC20Metadata(newCrunch);
        oneCrunch = 10**crunch.decimals();

        emit CrunchChanged(previous, newCrunch);
    }

    function setUsdc(address newUsdc) public onlyOwner {
        address previous = address(usdc);

        usdc = IERC20(newUsdc);

        emit UsdcChanged(previous, address(newUsdc));
    }

    function setPrice(uint256 newPrice) public onlyOwner {
        uint256 previous = price;

        price = newPrice;

        emit PriceChanged(previous, newPrice);
    }

    modifier onlyCrunch() {
        require(
            address(crunch) == _msgSender(),
            "Selling: caller is not the crunch token"
        );
        _;
    }
}
