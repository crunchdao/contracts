// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CrunchSelling is Ownable, Pausable {
    /** @dev Emitted when the crunch address is changed. */
    event CrunchChanged(address indexed previousCrunch, address indexed newCrunch);
    
    /** @dev Emitted when the usdc address is changed. */
    event UsdcChanged(address indexed previousUsdc, address indexed newUsdc);
    
    /** @dev Emitted when the price is changed. */
    event PriceChanged(uint256 previousPrice, uint256 newPrice);

    /** @dev CRUNCH erc20 address. */
    IERC20 public crunch;
    
    /** @dev USDC erc20 address. */
    IERC20 public usdc;
    
    /** @dev Crunch selling price in decimals (10^18). */
    uint256 public price;

    constructor(
        IERC20 _crunch,
        IERC20 _usdc,
        uint256 initialPrice
    ) {
        setCrunch(_crunch);
        setUsdc(_usdc);
        setPrice(initialPrice);
    }

    function sell(uint256 amount) public whenNotPaused {
      require(amount == 0, "Selling: cannot sell 0 unit");
      
      require(crunch.allowance(_msgSender(), address(this)) >= amount, "Selling: user's allowance is not enough");
      require(crunch.balanceOf(_msgSender()) >= amount, "Selling: user's balance is not enough");
      require(reserve() >= amount, "Selling: usdc reserve is not big enough");

      // TODO: Integrate the pricing method
      crunch.transferFrom(_msgSender(), owner(), amount);
      usdc.transfer(address(this), amount);
    }

    function reserve() public view returns (uint256) {
      return usdc.balanceOf(address(this));
    }

    function pause() external onlyOwner /* whenNotPaused */ {
      _pause();
    }

    function unpause() external onlyOwner /* whenPaused */ {
      _unpause();
    }

    function setCrunch(IERC20 newCrunch) onlyOwner public {
        require(
            address(newCrunch) != address(0),
            "Selling: new crunch address cannot be zero"
        );
        
        require(
            address(newCrunch) != address(crunch),
            "Selling: new crunch address cannot be the same as the previous one"
        );

        address previous = address(crunch);

        crunch = newCrunch;

        emit CrunchChanged(previous, address(newCrunch));
    }

    function setUsdc(IERC20 newUsdc) onlyOwner public {
        require(
            address(newUsdc) != address(0),
            "Selling: new usdc address cannot be zero"
        );
        
        require(
            address(newUsdc) != address(usdc),
            "Selling: new usdc address cannot be the same as the previous one"
        );

        address previous = address(usdc);

        usdc = newUsdc;

        emit CrunchChanged(previous, address(newUsdc));
    }

    function setPrice(uint256 newPrice) onlyOwner public {
        require(
            newPrice != price,
            "Selling: new usdc address cannot be the same as the previous one"
        );

        uint256 previous = price;

        price = newPrice;

        emit PriceChanged(previous, newPrice);
    }

}
