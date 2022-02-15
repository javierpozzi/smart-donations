// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Compound ERC20 Interface
 * 
 * @dev Interface of a cToken from Compound Protocol.
 */
interface CERC20 {
    function mint(uint256) external returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function redeemUnderlying(uint256) external returns (uint256);

    function accrueInterest() external returns (uint256);
}
