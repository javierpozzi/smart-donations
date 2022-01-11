// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ERC20 {
    function approve(address, uint256) external returns (bool);

    function transfer(address, uint256) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function balanceOf(address) external view returns (uint256);

    function decimals() external view returns (uint8);
}
