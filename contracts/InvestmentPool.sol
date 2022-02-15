// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./dtos/InvertibleTokenDTO.sol";
import "./interfaces/CERC20.sol";

/**
 * @title Investment Pool
 * 
 * @dev This contract is used to manage the invested tokens.
 * 
 * It integrates with Compound Protocol to allow investors to invest in the pool,
 * and creates an abstraction of this integration.
 * 
 * This contract keeps track of every conversion to ensure that external users
 * only see the underlying token (DAI, USDC...).
 * 
 * SafeERC20  wrapper is used to allow the use of non convencional tokens
 * like USDT.
 * 
 * All the transactions are only available to the owner, who should be another
 * contract acting as the controller of the system.
 * 
 */
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

    /**
     * @dev Invest an ERC20 token in the pool from the list of invertible tokens.
     *
     * This function will mint the cToken of the invertible token with the
     * specified amount, and will add the minted amount to the cToken balance
     * of the investor and the invested token amount to the total invested
     * amount of the investor.
     * 
     * @param _investor The address of the investor.
     * @param _symbol The symbol of the invertible token.
     * @param _amount The amount of tokens to invest.
     */
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

    /**
     * @dev Redeem the generated interests of an invertible token from the
     * cToken contract.
     *
     * This function will withdraw the generated interests of the cToken, and
     * will remove the minted amount from the cToken balance of the investor.
     * 
     * For more information about the calculation of the generated interests,
     * see the {_getTokenGeneratedInterests} function.
     * 
     * @param _investor The address of the investor.
     * @param _symbol The symbol of the invertible token.
     */
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

    /**
     * @dev Transfer an invertible token to an address.
     * 
     * @param _symbol The symbol of the invertible token. 
     * @param _to The address to transfer the invertible token to.
     * @param _amount The amount of tokens to transfer.
     */
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
    
    /**
     * @dev Return the address of the contract of an invertible token.
     * 
     * This is normally required for the investor to allow the {SmartDonation}
     * contract to use its tokens.
     */
    function getTokenAddress(bytes32 _symbol) external view returns (address) {
        address tokenAddress = address(invertibleTokens[_symbol].token);
        require(tokenAddress != address(0), "Invalid token symbol");
        return tokenAddress;
    }

    /**
     * @dev Return the symbols of the tokens available to invest.
    */
    function getInvertibleTokenSymbols()
        external
        view
        returns (bytes32[] memory)
    {
        return invertibleTokenSymbols;
    }

    /**
     * @dev Return the total amount of tokens invested by the sender.
     * 
     * @param _investor The address of the investor.
     * @param _symbol The symbol of the token to check.
     */
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

    /**
     * @dev Return the stored generated interests of an investor
     * for an invertible token.
     * 
     * This function will use the stored exchange rate, that is generated
     * by the last execution of the {accrueInterest} function inside the
     * cToken contract.
     *
     * The result from this function will give you an approximation
     * of the generated interests, but not the exact value.
     *
     * @param _investor The address of the investor.
     * @param _symbol The symbol of the invertible token.
     */
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

    /**
     * @dev Return the current generated interests of an investor
     * for an invertible token, with an specific exchange rate. This is
     * represented with the token value, not the cToken value.
     * 
     * The generated interests is calculated by:
     *  - Converting the cToken balance to the underlying token. This is done by
     *    multiplying the cToken balance by the exchange rate, and dividing it
     *    by the cTokens exponent (1e18).
     *  - Subtracting the total invested amount of the investor from the result
     *    of the previous conversion.
     */
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
