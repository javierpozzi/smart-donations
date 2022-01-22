// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./InvestmentPool.sol";
import "./TrustedDoneesManager.sol";
import "./dtos/DonatedDoneeDTO.sol";

contract SmartDonation {
    using SafeERC20 for IERC20;

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

    TrustedDoneesManager public trustedDoneesManager;
    InvestmentPool public investmentPool;

    constructor(
        address _trustedDoneesManagerAddress,
        address _investmentPoolAddress
    ) {
        trustedDoneesManager = TrustedDoneesManager(
            _trustedDoneesManagerAddress
        );
        investmentPool = InvestmentPool(_investmentPoolAddress);
    }

    function investToken(bytes32 _symbol, uint256 _amount) external {
        IERC20(investmentPool.getTokenAddress(_symbol)).safeTransferFrom(
            msg.sender,
            address(investmentPool),
            _amount
        );
        investmentPool.investToken(msg.sender, _symbol, _amount);
        emit Investment(msg.sender, _symbol, _amount);
    }

    function donateTokensGeneratedInterests(
        DonatedDoneeDTO[] calldata _donatedDoneeDTOs
    ) external {
        require(
            _donatedDoneeDTOs.length > 0,
            "There must be at least one donee"
        );
        validateDonees(_donatedDoneeDTOs);
        bool hasGeneratedInterests = false;
        bytes32[] memory invertibleTokenSymbols = investmentPool
            .getInvertibleTokenSymbols();
        for (uint256 i = 0; i < invertibleTokenSymbols.length; i++) {
            bool _hasGeneratedInterests = donateTokenGeneratedInterests(
                invertibleTokenSymbols[i],
                _donatedDoneeDTOs
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
        return
            investmentPool.getTokenGeneratedInterestsStored(
                msg.sender,
                _symbol
            );
    }

    function getTokenInvestedAmount(bytes32 _symbol)
        external
        view
        returns (uint256)
    {
        return investmentPool.getTokenInvestedAmount(msg.sender, _symbol);
    }

    function donateTokenGeneratedInterests(
        bytes32 _symbol,
        DonatedDoneeDTO[] memory _donatedDoneeDTOs
    ) internal returns (bool) {
        uint256 generatedInterests = investmentPool
            .redeemTokenGeneratedInterests(msg.sender, _symbol);
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
            investmentPool.transferToken(_symbol, doneeAddress, amount);
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
