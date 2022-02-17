// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract VCrunchToken is Ownable {
    struct Invokable {
        address target;
        string signature;
    }

    /* CRUNCH erc20 address. */
    IERC20Metadata public crunch;

    mapping(address => Invokable[]) public singulars;
    Invokable[] public multiples;

    constructor(address _crunch) {
        crunch = IERC20Metadata(_crunch);
    }

    function name() external pure returns (string memory) {
        return "Vested CRUNCH Token";
    }

    function symbol() external pure returns (string memory) {
        return "vCRUNCH";
    }

    function decimals() external view returns (uint8) {
        return crunch.decimals();
    }

    function balanceOf(address beneficiary)
        external
        view
        returns (uint256 total)
    {
        Invokable[] storage invokables = singulars[beneficiary];
        for (uint256 index = 0; index < invokables.length; index++) {
            (bool success, uint256 balance) = _invoke(invokables[index]);

            if (success) {
                total += balance;
            }
        }

        for (uint256 index = 0; index < multiples.length; index++) {
            (bool success, uint256 balance) = _invoke(
                multiples[index],
                beneficiary
            );

            if (success) {
                total += balance;
            }
        }
    }

    function addSingular(
        address beneficiary,
        address target,
        string calldata signature
    ) external onlyOwner {
        _add(singulars[beneficiary], target, signature);
    }

    function addMultiple(address target, string calldata signature)
        external
        onlyOwner
    {
        _add(multiples, target, signature);
    }

    function _add(
        Invokable[] storage invokables,
        address target,
        string calldata signature
    ) internal {
        // uint256 index = invokables.length;
        invokables.push(Invokable(target, signature));

        // TODO: This consume all of the gas...
        // (bool success, ) = _invoke(invokables[index]);
        // require(success, "Test failed");
    }

    function _invoke(Invokable storage invokable)
        internal
        view
        returns (bool, uint256)
    {
        (bool success, bytes memory data) = invokable.target.staticcall(
            abi.encodeWithSignature(invokable.signature)
        );

        return _decode(success, data);
    }

    function _invoke(Invokable storage invokable, address beneficiary)
        internal
        view
        returns (bool, uint256)
    {
        (bool success, bytes memory data) = invokable.target.staticcall(
            abi.encodeWithSignature(invokable.signature, beneficiary)
        );

        return _decode(success, data);
    }

    function _decode(bool success, bytes memory data)
        internal
        pure
        returns (bool, uint256)
    {
        if (success && data.length == 32) {
            // https://ethereum.stackexchange.com/a/54405/78796

            uint256 x;
            assembly {
                x := mload(add(data, 0x20))
            }

            return (true, x);
        }

        return (false, 0);
    }
}
