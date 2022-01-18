// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./InvestmentPool.sol";
import "./TrustedDoneesManager.sol";
import "./dtos/InvertibleTokenDTO.sol";
import "./dtos/DonatedDoneeDTO.sol";

contract SmartDonation {
    event Investment(
        address indexed from,
        bytes32 indexed symbol,
        uint256 amount
    );
    event Donation(
        address indexed from,
        address indexed to,
        bytes32 indexed symbol,
        uint256 amount
    );

    struct InvertibleToken {
        ERC20 token;
        CERC20 cToken;
    }

    TrustedDoneesManager public trustedDoneesManager;

    mapping(address => InvestmentPool) public investmentPools;

    mapping(bytes32 => InvertibleToken) public invertibleTokens;
    bytes32[] public invertibleTokenSymbols;

    constructor(
        address trustedDoneesManagerAddress,
        InvertibleTokenDTO[] memory invertibleTokenDTOs
    ) {
        trustedDoneesManager = TrustedDoneesManager(
            trustedDoneesManagerAddress
        );
        for (uint256 i = 0; i < invertibleTokenDTOs.length; i++) {
            InvertibleTokenDTO memory invertibleTokenDTO = invertibleTokenDTOs[
                i
            ];
            InvertibleToken memory invertibleToken = InvertibleToken({
                token: ERC20(invertibleTokenDTO.tokenAddress),
                cToken: CERC20(invertibleTokenDTO.cTokenAddress)
            });
            invertibleTokens[invertibleTokenDTO.symbol] = invertibleToken;
            invertibleTokenSymbols.push(invertibleTokenDTO.symbol);
        }
    }

    function openInvestmentPool() external {
        require(
            address(investmentPools[msg.sender]) == address(0),
            "Investment pool already opened"
        );
        investmentPools[msg.sender] = new InvestmentPool();
    }

    function investToken(bytes32 _symbol, uint256 _amount) external {
        InvestmentPool investmentPool = investmentPools[msg.sender];
        require(
            address(investmentPool) != address(0),
            "Investment pool not found"
        );
        InvertibleToken memory invertibleToken = invertibleTokens[_symbol];
        require(
            address(invertibleToken.token) != address(0),
            "Invalid token symbol"
        );
        invertibleToken.token.transferFrom(
            msg.sender,
            address(investmentPool),
            _amount
        );
        investmentPool.investToken(
            _symbol,
            invertibleToken.token,
            invertibleToken.cToken,
            _amount
        );
        emit Investment(msg.sender, _symbol, _amount);
    }

    function donateTokensGeneratedInterests(
        DonatedDoneeDTO[] calldata _donatedDoneeDTOs
    ) external {
        InvestmentPool investmentPool = investmentPools[msg.sender];
        require(
            address(investmentPool) != address(0),
            "Investment pool not found"
        );
        require(
            _donatedDoneeDTOs.length > 0,
            "There must be at least one donee"
        );
        validateDonees(_donatedDoneeDTOs);
        bool hasGeneratedInterests = false;
        for (uint256 i = 0; i < invertibleTokenSymbols.length; i++) {
            bool _hasGeneratedInterests = donateTokenGeneratedInterests(
                investmentPool,
                _donatedDoneeDTOs,
                invertibleTokenSymbols[i]
            );
            if (_hasGeneratedInterests) {
                hasGeneratedInterests = true;
            }
        }
        require(hasGeneratedInterests, "No generated interests");
    }

    function getTokenGeneratedInterests(bytes32 _symbol)
        external
        view
        returns (uint256)
    {
        InvestmentPool investmentPool = investmentPools[msg.sender];
        require(
            address(investmentPool) != address(0),
            "Investment pool not found"
        );
        InvertibleToken memory invertibleToken = invertibleTokens[_symbol];
        require(
            address(invertibleToken.cToken) != address(0),
            "Invalid token symbol"
        );
        return
            investmentPool.getTokenGeneratedInterestsStored(
                _symbol,
                invertibleToken.cToken
            );
    }

    function getTotalInvestedToken(bytes32 _symbol)
        external
        view
        returns (uint256)
    {
        InvestmentPool investmentPool = investmentPools[msg.sender];
        require(
            address(investmentPool) != address(0),
            "Investment pool not found"
        );
        InvertibleToken memory invertibleToken = invertibleTokens[_symbol];
        require(
            address(invertibleToken.token) != address(0),
            "Invalid token symbol"
        );
        return investmentPool.totalInvestedTokens(_symbol);
    }

    function donateTokenGeneratedInterests(
        InvestmentPool investmentPool,
        DonatedDoneeDTO[] memory _donatedDoneeDTOs,
        bytes32 _symbol
    ) internal returns (bool) {
        InvertibleToken memory invertibleToken = invertibleTokens[_symbol];
        uint256 generatedInterests = investmentPool
            .redeemTokenGeneratedInterests(_symbol, invertibleToken.cToken);
        if (generatedInterests == 0) {
            return false;
        }
        uint256 totalDonated = 0;
        for (uint256 i = 0; i < _donatedDoneeDTOs.length; i++) {
            address doneeAddress = _donatedDoneeDTOs[i].doneeAddress;
            uint8 percentage = _donatedDoneeDTOs[i].percentage;
            bool lastDonee = i == _donatedDoneeDTOs.length - 1;
            uint256 amount = lastDonee
                ? (generatedInterests - totalDonated) // Avoid rounding errors
                : (generatedInterests * percentage) / 100;
            totalDonated += amount;
            investmentPool.transferToken(
                invertibleToken.token,
                doneeAddress,
                amount
            );
            emit Donation(msg.sender, doneeAddress, _symbol, amount);
        }
        return true;
    }

    function validateDonees(DonatedDoneeDTO[] memory _donatedDoneeDTOs)
        internal
        view
    {
        uint8 totalPercentage = 0;
        for (uint256 i = 0; i < _donatedDoneeDTOs.length; i++) {
            address doneeAddress = _donatedDoneeDTOs[i].doneeAddress;
            uint8 percentage = _donatedDoneeDTOs[i].percentage;
            require(
                percentage > 0 && percentage <= 100,
                "Percentage must be between 1-100"
            );
            require(doneeAddress != address(0), "Donee address cannot be 0");
            require(
                trustedDoneesManager.isDoneeEnabled(doneeAddress),
                "Only trusted donees are valid"
            );
            totalPercentage += percentage;
        }
        require(totalPercentage == 100, "Total percentage must be 100");
    }
}
