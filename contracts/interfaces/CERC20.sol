// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface CERC20 {
    function mint(uint256) external returns (uint256);

    function redeem(uint256) external returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function supplyRatePerBlock() external returns (uint256);

    function redeemUnderlying(uint256) external returns (uint256);

    function balanceOfUnderlying(address owner) external returns (uint256);

    function accrueInterest() external returns (uint);

    function getCash() external view returns (uint);
    function totalBorrows() external view returns (uint);
    function totalReserves() external view returns (uint);
    function totalSupply() external view returns (uint);

}
