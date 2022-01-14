// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/CERC20.sol";
import "./interfaces/ERC20.sol";

contract InvestmentPool is Ownable {
    mapping(bytes32 => uint256) public totalInvestedTokens;

    function investToken(
        bytes32 _symbol,
        ERC20 _token,
        CERC20 _cToken,
        uint256 _amount
    ) external onlyOwner {
        require(_amount > 0, "Amount must be greater than 0");
        require(address(_token) != address(0), "Token address cannot be 0");
        require(address(_cToken) != address(0), "cToken address cannot be 0");

        totalInvestedTokens[_symbol] += _amount;
        _token.approve(address(_cToken), _amount);
        uint256 mintResult = _cToken.mint(_amount);
        require(mintResult == 0, "Failed to mint");
    }

    function redeemTokenGeneratedInterests(
        bytes32 _symbol,
        ERC20 _token,
        CERC20 _cToken
    ) external onlyOwner returns (uint256) {
        uint256 generatedInterests = getTokenGeneratedInterestsCurrent(
            _symbol,
            _token,
            _cToken
        );
        if (generatedInterests == 0) {
            return 0;
        }
        _cToken.redeemUnderlying(generatedInterests);
        return generatedInterests;
    }

    function transferToken(
        ERC20 _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        _token.transfer(_to, _amount);
    }

    function getTokenGeneratedInterestsStored(
        bytes32 _symbol,
        ERC20 _token,
        CERC20 _cToken
    ) external view onlyOwner returns (uint256) {
        return
            _getTokenGeneratedInterests(
                _symbol,
                _token,
                _cToken,
                _cToken.exchangeRateStored()
            );
    }

    function getTokenGeneratedInterestsCurrent(
        bytes32 _symbol,
        ERC20 _token,
        CERC20 _cToken
    ) public onlyOwner returns (uint256) {
        return
            _getTokenGeneratedInterests(
                _symbol,
                _token,
                _cToken,
                _cToken.exchangeRateCurrent()
            );
    }

    function _getTokenGeneratedInterests(
        bytes32 _symbol,
        ERC20 _token,
        CERC20 _cToken,
        uint256 exchangeRate
    ) internal view onlyOwner returns (uint256) {
        uint8 tokenDecimals = _token.decimals();
        uint256 balance = (_cToken.balanceOf(address(this)) * exchangeRate) /
            (10**tokenDecimals);
        uint256 totalInvested = totalInvestedTokens[_symbol];
        return balance > totalInvested ? balance - totalInvested : 0;
    }
}
