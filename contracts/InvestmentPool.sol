// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./dtos/InvertibleTokenDTO.sol";
import "./interfaces/CERC20.sol";

contract InvestmentPool is Ownable {
    using SafeERC20 for IERC20;

    struct InvertibleToken {
        IERC20 token;
        CERC20 cToken;
    }

    struct TokenPool {
        uint256 cTokenBalance;
        uint256 investedAmount;
    }

    mapping(address => mapping(bytes32 => TokenPool)) public tokenPools;

    mapping(bytes32 => InvertibleToken) public invertibleTokens;
    bytes32[] public invertibleTokenSymbols;

    constructor(InvertibleTokenDTO[] memory _invertibleTokenDTOs) {
        for (uint256 i = 0; i < _invertibleTokenDTOs.length; i++) {
            InvertibleTokenDTO memory invertibleTokenDTO = _invertibleTokenDTOs[
                i
            ];
            InvertibleToken memory invertibleToken = InvertibleToken({
                token: IERC20(invertibleTokenDTO.tokenAddress),
                cToken: CERC20(invertibleTokenDTO.cTokenAddress)
            });
            invertibleTokens[invertibleTokenDTO.symbol] = invertibleToken;
            invertibleTokenSymbols.push(invertibleTokenDTO.symbol);
        }
    }

    function investToken(
        address _investor,
        bytes32 _symbol,
        uint256 _amount
    ) external onlyOwner {
        require(_amount > 0, "Amount must be greater than 0");
        InvertibleToken memory invertibleToken = invertibleTokens[_symbol];
        require(
            address(invertibleToken.token) != address(0),
            "Invalid token symbol"
        );
        tokenPools[_investor][_symbol].investedAmount += _amount;
        uint256 cTokenBalanceBeforeMint = invertibleToken.cToken.balanceOf(
            address(this)
        );
        invertibleToken.token.safeIncreaseAllowance(
            address(invertibleToken.cToken),
            _amount
        );
        uint256 mintResult = invertibleToken.cToken.mint(_amount);
        require(mintResult == 0, "Failed to mint");
        uint256 cTokenBalanceAfterMint = invertibleToken.cToken.balanceOf(
            address(this)
        );
        tokenPools[_investor][_symbol].cTokenBalance +=
            cTokenBalanceAfterMint -
            cTokenBalanceBeforeMint;
    }

    function redeemTokenGeneratedInterests(address _investor, bytes32 _symbol)
        external
        onlyOwner
        returns (uint256)
    {
        InvertibleToken memory invertibleToken = invertibleTokens[_symbol];
        require(
            address(invertibleToken.token) != address(0),
            "Invalid token symbol"
        );
        uint256 exchangeRateCurrent = invertibleToken
            .cToken
            .exchangeRateCurrent();
        uint256 generatedInterests = _getTokenGeneratedInterests(
            _investor,
            _symbol,
            exchangeRateCurrent
        );
        if (generatedInterests == 0) {
            return 0;
        }
        tokenPools[_investor][_symbol].cTokenBalance -=
            (generatedInterests * 1e18) /
            exchangeRateCurrent;
        invertibleToken.cToken.redeemUnderlying(generatedInterests);
        return generatedInterests;
    }

    function transferToken(
        bytes32 _symbol,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        InvertibleToken memory invertibleToken = invertibleTokens[_symbol];
        require(
            address(invertibleToken.token) != address(0),
            "Invalid token symbol"
        );
        invertibleToken.token.safeTransfer(_to, _amount);
    }

    function getTokenAddress(bytes32 _symbol) external view returns (address) {
        address tokenAddress = address(invertibleTokens[_symbol].token);
        require(tokenAddress != address(0), "Invalid token symbol");
        return tokenAddress;
    }

    function getInvertibleTokenSymbols()
        external
        view
        returns (bytes32[] memory)
    {
        return invertibleTokenSymbols;
    }

    function getTokenInvestedAmount(address _investor, bytes32 _symbol)
        external
        view
        returns (uint256)
    {
        require(
            address(invertibleTokens[_symbol].token) != address(0),
            "Invalid token symbol"
        );
        return tokenPools[_investor][_symbol].investedAmount;
    }

    function getTokenGeneratedInterestsStored(
        address _investor,
        bytes32 _symbol
    ) external view returns (uint256) {
        InvertibleToken memory invertibleToken = invertibleTokens[_symbol];
        require(
            address(invertibleToken.token) != address(0),
            "Invalid token symbol"
        );
        return
            _getTokenGeneratedInterests(
                _investor,
                _symbol,
                invertibleToken.cToken.exchangeRateStored()
            );
    }

    function _getTokenGeneratedInterests(
        address _investor,
        bytes32 _symbol,
        uint256 exchangeRate
    ) internal view returns (uint256) {
        TokenPool memory tokenPool = tokenPools[_investor][_symbol];
        uint256 balance = (tokenPool.cTokenBalance * exchangeRate) / 1e18;
        uint256 investedAmount = tokenPool.investedAmount;
        return balance > investedAmount ? balance - investedAmount : 0;
    }
}
