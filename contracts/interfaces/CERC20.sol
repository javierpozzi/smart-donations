// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface CERC20 {
    function mint(uint256) external returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function redeemUnderlying(uint256) external returns (uint256);

    function accrueInterest() external returns (uint256);
}
