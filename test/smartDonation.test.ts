import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { CERC20, ERC20, SmartDonation } from "../typechain";
import {
  cTokenToToken,
  parseDaiUnits,
  parseUsdcUnits,
  seedDAI,
  seedUSDC,
} from "./utils/ERC20Utils";

describe("Smart Donation", function () {
  const daiAsBytes32 = ethers.utils.formatBytes32String("DAI");
  const usdcAsBytes32 = ethers.utils.formatBytes32String("USDC");
  const oneThousandDais = parseDaiUnits(1000);
  const oneHundredThousandDais = parseDaiUnits(100000);
  const oneHundredThousandUsdcs = parseUsdcUnits(100000);

  let smartDonationContract: SmartDonation;
  let cDaiContract: CERC20;
  let daiContract: ERC20;
  let cUsdcContract: CERC20;
  let usdcContract: ERC20;
  let donor: SignerWithAddress;
  let donor2: SignerWithAddress;
  let trustedDonee1: SignerWithAddress;
  let trustedDonee2: SignerWithAddress;
  let trustedDonee3: SignerWithAddress;
  let trustedDonee4: SignerWithAddress;
  let untrustedDonee: SignerWithAddress;
  let owner: SignerWithAddress;
  let accounts: SignerWithAddress[];

  before(async () => {
    cDaiContract = await ethers.getContractAt(
      "CERC20",
      process.env.COMPOUND_DAI_CONTRACT_ADDRESS!
    );
    daiContract = await ethers.getContractAt(
      "ERC20",
      process.env.DAI_CONTRACT_ADDRESS!
    );
    cUsdcContract = await ethers.getContractAt(
      "CERC20",
      process.env.COMPOUND_USDC_CONTRACT_ADDRESS!
    );
    usdcContract = await ethers.getContractAt(
      "ERC20",
      process.env.USDC_CONTRACT_ADDRESS!
    );
    accounts = await ethers.getSigners();
    donor = accounts[0];
    donor2 = accounts[1];
    trustedDonee1 = accounts[10];
    trustedDonee2 = accounts[11];
    trustedDonee3 = accounts[12];
    trustedDonee4 = accounts[13];
    untrustedDonee = accounts[18];
    owner = accounts[19];
  });

  beforeEach(async function () {
    const TrustedDoneesManager = await ethers.getContractFactory(
      "TrustedDoneesManager"
    );
    const trustedDoneesManagerContract = await TrustedDoneesManager.connect(
      owner
    ).deploy();
    await trustedDoneesManagerContract.deployed();
    await trustedDoneesManagerContract.addDonee(
      ethers.utils.formatBytes32String("Donee 1"),
      trustedDonee1.address
    );
    await trustedDoneesManagerContract.addDonee(
      ethers.utils.formatBytes32String("Donee 2"),
      trustedDonee2.address
    );
    await trustedDoneesManagerContract.addDonee(
      ethers.utils.formatBytes32String("Donee 3"),
      trustedDonee3.address
    );
    await trustedDoneesManagerContract.addDonee(
      ethers.utils.formatBytes32String("Donee 4"),
      trustedDonee4.address
    );

    const SmartDonation = await ethers.getContractFactory("SmartDonation");
    const ownerSmartDonationContract = await SmartDonation.connect(
      owner
    ).deploy(trustedDoneesManagerContract.address, [
      {
        symbol: daiAsBytes32,
        tokenAddress: process.env.DAI_CONTRACT_ADDRESS!,
        cTokenAddress: process.env.COMPOUND_DAI_CONTRACT_ADDRESS!,
      },
      {
        symbol: usdcAsBytes32,
        tokenAddress: process.env.USDC_CONTRACT_ADDRESS!,
        cTokenAddress: process.env.COMPOUND_USDC_CONTRACT_ADDRESS!,
      },
    ]);
    await ownerSmartDonationContract.deployed();
    smartDonationContract = ownerSmartDonationContract.connect(donor);
    await seedDAI(donor.address, oneHundredThousandDais);
    await seedUSDC(donor.address, oneHundredThousandUsdcs);
    await seedDAI(donor2.address, oneHundredThousandDais);
    await seedUSDC(donor2.address, oneHundredThousandUsdcs);
  });

  describe("Open investment pool", function () {
    it("Should open personal investment pool", async function () {
      await smartDonationContract.openInvestmentPool();

      const investmentPoolAddress = await smartDonationContract.investmentPools(
        donor.address
      );

      expect(investmentPoolAddress).to.not.be.equal(
        "0x0000000000000000000000000000000000000000"
      );
    });

    it("Should not be able to open more than one personal investment pool from the same address", async function () {
      await smartDonationContract.openInvestmentPool();

      await expect(
        smartDonationContract.openInvestmentPool()
      ).to.be.revertedWith("Investment pool already opened");
    });

    it("Should not be able to use other's personal investment pool", async function () {
      await smartDonationContract.openInvestmentPool();

      await expect(
        smartDonationContract
          .connect(donor2)
          .getTokenGeneratedInterests(daiAsBytes32)
      ).to.be.revertedWith("Investment pool not found");
    });
  });

  describe("Invest token", function () {
    it("Should invest token and see the amount on the investment pool contract", async function () {
      await smartDonationContract.openInvestmentPool();

      await daiContract.approve(smartDonationContract.address, oneThousandDais);
      await smartDonationContract.investToken(daiAsBytes32, oneThousandDais);

      const totalInvestedDai =
        await smartDonationContract.getTotalInvestedToken(daiAsBytes32);

      expect(totalInvestedDai).to.be.equal(oneThousandDais);
    });

    it("Should be able to invest multiple tokens and see the invested amount of each one on the investment pool contract", async function () {
      const tokens = [
        {
          symbol: daiAsBytes32,
          contract: daiContract,
          cContract: cDaiContract,
          amount: oneThousandDais,
        },
        {
          symbol: usdcAsBytes32,
          contract: usdcContract,
          cContract: cUsdcContract,
          amount: oneHundredThousandUsdcs,
        },
      ];

      await smartDonationContract.openInvestmentPool();

      tokens.forEach(async (token) => {
        await token.contract.approve(
          smartDonationContract.address,
          token.amount
        );
        await smartDonationContract.investToken(token.symbol, token.amount);
        const totalInvestedToken =
          await smartDonationContract.getTotalInvestedToken(token.symbol);
        expect(totalInvestedToken).to.be.equal(token.amount);
      });
    });

    it("Should be able to invest multiple tokens and see the invested amount of each one on the investment pool cToken balance", async function () {
      const tokens = [
        {
          symbol: daiAsBytes32,
          contract: daiContract,
          cContract: cDaiContract,
          amount: oneThousandDais,
        },
        {
          symbol: usdcAsBytes32,
          contract: usdcContract,
          cContract: cUsdcContract,
          amount: oneHundredThousandUsdcs,
        },
      ];

      await smartDonationContract.openInvestmentPool();

      const investmentPoolContract =
        await smartDonationContract.investmentPools(donor.address);

      tokens.forEach(async (token) => {
        await token.contract.approve(
          smartDonationContract.address,
          token.amount
        );
        await smartDonationContract.investToken(token.symbol, token.amount);
        const cTokenBalance = await token.cContract.balanceOf(
          investmentPoolContract
        );
        const cTokenExchangeRate = await token.cContract.exchangeRateStored();
        const cTokenBalanceInTokens = cTokenToToken(
          cTokenBalance,
          cTokenExchangeRate
        );
        expect(cTokenBalanceInTokens).to.be.closeTo(token.amount, 1e10);
      });
    });

    it("Should emit Investment event when investing token", async function () {
      await smartDonationContract.openInvestmentPool();

      await daiContract.approve(smartDonationContract.address, oneThousandDais);

      await expect(
        smartDonationContract.investToken(daiAsBytes32, oneThousandDais)
      )
        .to.emit(smartDonationContract, "Investment")
        .withArgs(donor.address, daiAsBytes32, oneThousandDais);
    });

    it("Should not be able to invest without an opened investment pool", async function () {
      await expect(
        smartDonationContract.investToken(daiAsBytes32, oneThousandDais)
      ).to.be.revertedWith("Investment pool not found");
    });

    it("Should not be able to invest without sufficient allowance", async function () {
      await smartDonationContract.openInvestmentPool();

      await daiContract.approve(
        smartDonationContract.address,
        oneThousandDais.sub(1)
      );

      await expect(
        smartDonationContract.investToken(daiAsBytes32, oneThousandDais)
      ).to.be.revertedWith("Dai/insufficient-allowance");
    });

    it("Should not be able to invest on a token that is not on the invertible tokens list", async function () {
      await smartDonationContract.openInvestmentPool();

      await expect(
        smartDonationContract.investToken(
          ethers.utils.formatBytes32String("INVALID-TOKEN"),
          ethers.utils.parseUnits("10", 18)
        )
      ).to.be.revertedWith("Invalid token symbol");
    });
  });

  describe("Token generated interests", function () {
    it("Should not be able to get a token generated interests without an opened investment pool", async function () {
      await expect(
        smartDonationContract.getTokenGeneratedInterests(daiAsBytes32)
      ).to.be.revertedWith("Investment pool not found");
    });

    it("Should not be able to get the generated interests of a token that is not on the invertible tokens list", async function () {
      await smartDonationContract.openInvestmentPool();

      await expect(
        smartDonationContract.getTokenGeneratedInterests(
          ethers.utils.formatBytes32String("INVALID-TOKEN")
        )
      ).to.be.revertedWith("Invalid token symbol");
    });
  });

  describe("Total invested token", function () {
    it("Should not be able to get the total invested of a token without an opened investment pool", async function () {
      await expect(
        smartDonationContract.getTotalInvestedToken(daiAsBytes32)
      ).to.be.revertedWith("Investment pool not found");
    });

    it("Should not be able to get the total invested of a token that is not on the invertible tokens list", async function () {
      await smartDonationContract.openInvestmentPool();

      await expect(
        smartDonationContract.getTotalInvestedToken(
          ethers.utils.formatBytes32String("INVALID-TOKEN")
        )
      ).to.be.revertedWith("Invalid token symbol");
    });
  });
  describe("Donate token generated interests", function () {
    it("Should emit Donate event when donating", async function () {
      const donees = [{ doneeAddress: trustedDonee1.address, percentage: 100 }];

      await smartDonationContract.openInvestmentPool();
      await daiContract.approve(
        smartDonationContract.address,
        oneHundredThousandDais
      );
      await smartDonationContract.investToken(
        daiAsBytes32,
        oneHundredThousandDais
      );

      const donateTransaction =
        await smartDonationContract.donateTokensGeneratedInterests(donees);
      const donateReceipt = await donateTransaction.wait();
      const donationEvent = donateReceipt.events!.find(
        (event) => event.event === "Donation"
      );
      const [from, to, symbol] = donationEvent!.args!;

      expect(from).to.be.equals(donor.address);
      expect(to).to.be.equals(donees[0].doneeAddress);
      expect(symbol).to.be.equals(daiAsBytes32);
    });

    it("Should donate to multiple donees", async function () {
      const donees = [
        { doneeAddress: trustedDonee1.address, percentage: 23 },
        { doneeAddress: trustedDonee2.address, percentage: 24 },
        { doneeAddress: trustedDonee3.address, percentage: 26 },
        { doneeAddress: trustedDonee4.address, percentage: 27 },
      ];

      const doneesBalanceBeforeDonation = await Promise.all(
        donees.map(async (donee) => daiContract.balanceOf(donee.doneeAddress))
      );

      await smartDonationContract.openInvestmentPool();
      await daiContract.approve(
        smartDonationContract.address,
        oneHundredThousandDais
      );
      await smartDonationContract.investToken(
        daiAsBytes32,
        oneHundredThousandDais
      );
      const donateTransaction =
        await smartDonationContract.donateTokensGeneratedInterests(donees);
      const donateReceipt = await donateTransaction.wait();
      const donationEvents = donateReceipt.events!.filter(
        (event) => event.event === "Donation"
      );

      const doneesBalanceAfterDonation = await Promise.all(
        donees.map(async (donee) => daiContract.balanceOf(donee.doneeAddress))
      );

      donees.forEach((donee, index) => {
        const doneeDonationEvent = donationEvents.find(
          (donationEvent) => donationEvent.args!.to === donee.doneeAddress
        );
        const [from, to, symbol, amount] = doneeDonationEvent!.args!;
        const doneeBalanceBeforeDonation = doneesBalanceBeforeDonation[index];
        const doneeBalanceAfterDonation = doneesBalanceAfterDonation[index];
        expect(from).to.be.equals(donor.address);
        expect(to).to.be.equals(donee.doneeAddress);
        expect(symbol).to.be.equals(daiAsBytes32);
        expect(amount).to.be.equals(
          doneeBalanceAfterDonation.sub(doneeBalanceBeforeDonation)
        );
      });
    });

    it("Should donate to multiple tokens", async function () {
      const donee = { doneeAddress: trustedDonee1.address, percentage: 100 };
      const tokens = [
        {
          symbol: daiAsBytes32,
          contract: daiContract,
          amount: oneHundredThousandDais,
        },
        {
          symbol: usdcAsBytes32,
          contract: usdcContract,
          amount: oneHundredThousandUsdcs,
        },
      ];

      const doneeTokensBalanceBeforeDonation = await Promise.all(
        tokens.map(async (token) =>
          token.contract.balanceOf(donee.doneeAddress)
        )
      );

      await smartDonationContract.openInvestmentPool();

      await Promise.all(
        tokens.map(async (token) => {
          await token.contract.approve(
            smartDonationContract.address,
            token.amount
          );
          await smartDonationContract.investToken(token.symbol, token.amount);
        })
      );

      const donateTransaction =
        await smartDonationContract.donateTokensGeneratedInterests([donee]);
      const donateReceipt = await donateTransaction.wait();
      const donationEvents = donateReceipt.events!.filter(
        (event) => event.event === "Donation"
      );

      const doneeTokensBalanceAfterDonation = await Promise.all(
        tokens.map(async (token) =>
          token.contract.balanceOf(donee.doneeAddress)
        )
      );

      tokens.forEach((token, index) => {
        const tokenDonationEvent = donationEvents.find(
          (donationEvent) => donationEvent.args!.symbol === token.symbol
        );
        const [from, to, symbol, amount] = tokenDonationEvent!.args!;
        const doneeTokenBalanceBeforeDonation =
          doneeTokensBalanceBeforeDonation[index];
        const doneeTokenBalanceAfterDonation =
          doneeTokensBalanceAfterDonation[index];
        expect(from).to.be.equals(donor.address);
        expect(to).to.be.equals(donee.doneeAddress);
        expect(symbol).to.be.equals(token.symbol);
        expect(amount).to.be.equals(
          doneeTokenBalanceAfterDonation.sub(doneeTokenBalanceBeforeDonation)
        );
      });
    });

    it("Should donate to multiple donees and tokens", async function () {
      const donees = [
        {
          doneeAddress: trustedDonee1.address,
          percentage: 23,
          tokenBalancesBeforeDonation: <Array<BigNumber>>[],
          tokenBalancesAfterDonation: <Array<BigNumber>>[],
        },
        {
          doneeAddress: trustedDonee2.address,
          percentage: 24,
          tokenBalancesBeforeDonation: <Array<BigNumber>>[],
          tokenBalancesAfterDonation: <Array<BigNumber>>[],
        },
        {
          doneeAddress: trustedDonee3.address,
          percentage: 26,
          tokenBalancesBeforeDonation: <Array<BigNumber>>[],
          tokenBalancesAfterDonation: <Array<BigNumber>>[],
        },
        {
          doneeAddress: trustedDonee4.address,
          percentage: 27,
          tokenBalancesBeforeDonation: <Array<BigNumber>>[],
          tokenBalancesAfterDonation: <Array<BigNumber>>[],
        },
      ];
      const tokens = [
        {
          symbol: daiAsBytes32,
          contract: daiContract,
          amount: oneHundredThousandDais,
        },
        {
          symbol: usdcAsBytes32,
          contract: usdcContract,
          amount: oneHundredThousandUsdcs,
        },
      ];

      donees.forEach(async (donee) => {
        donee.tokenBalancesBeforeDonation = await Promise.all(
          tokens.map(async (token) =>
            token.contract.balanceOf(donee.doneeAddress)
          )
        );
      });

      await smartDonationContract.openInvestmentPool();

      await Promise.all(
        tokens.map(async (token) => {
          await token.contract.approve(
            smartDonationContract.address,
            token.amount
          );
          await smartDonationContract.investToken(token.symbol, token.amount);
        })
      );

      const donateTransaction =
        await smartDonationContract.donateTokensGeneratedInterests(donees);
      const donateReceipt = await donateTransaction.wait();
      const donationEvents = donateReceipt.events!.filter(
        (event) => event.event === "Donation"
      );

      donees.forEach(async (donee) => {
        donee.tokenBalancesAfterDonation = await Promise.all(
          tokens.map(async (token) =>
            token.contract.balanceOf(donee.doneeAddress)
          )
        );

        tokens.forEach((token, tokenIndex) => {
          const tokenDonationEvent = donationEvents.find(
            (donationEvent) =>
              donationEvent.args!.to === donee.doneeAddress &&
              donationEvent.args!.symbol === token.symbol
          );
          const [from, to, symbol, amount] = tokenDonationEvent!.args!;
          const doneeTokenBalanceBeforeDonation =
            donee.tokenBalancesBeforeDonation[tokenIndex];
          const doneeTokenBalanceAfterDonation =
            donee.tokenBalancesAfterDonation[tokenIndex];
          expect(from).to.be.equals(donor.address);
          expect(to).to.be.equals(donee.doneeAddress);
          expect(symbol).to.be.equals(token.symbol);
          expect(amount).to.be.equals(
            doneeTokenBalanceAfterDonation.sub(doneeTokenBalanceBeforeDonation)
          );
        });
      });
    });

    it("Should have donee token balance the same token amount as token generated interests", async function () {
      const donees = [{ doneeAddress: trustedDonee1.address, percentage: 100 }];

      const donee1BalanceBeforeDonation = await daiContract.balanceOf(
        trustedDonee1.address
      );

      await smartDonationContract.openInvestmentPool();
      await daiContract.approve(
        smartDonationContract.address,
        oneHundredThousandDais
      );
      await smartDonationContract.investToken(
        daiAsBytes32,
        oneHundredThousandDais
      );

      const donateTransaction =
        await smartDonationContract.donateTokensGeneratedInterests(donees);
      const donateReceipt = await donateTransaction.wait();
      const donationEvent = donateReceipt.events!.find(
        (event) => event.event === "Donation"
      );
      const donatedAmount = donationEvent!.args!.amount;

      const donee1BalanceAfterDonation = await daiContract.balanceOf(
        trustedDonee1.address
      );

      expect(
        donee1BalanceAfterDonation.sub(donee1BalanceBeforeDonation)
      ).to.be.equals(donatedAmount);
    });

    it("Should not change investment pool token balance with donation", async function () {
      const donees = [
        { doneeAddress: trustedDonee1.address, percentage: 33 },
        { doneeAddress: trustedDonee2.address, percentage: 33 },
        { doneeAddress: trustedDonee3.address, percentage: 33 },
        { doneeAddress: trustedDonee4.address, percentage: 1 },
      ];

      await smartDonationContract.openInvestmentPool();
      await daiContract.approve(
        smartDonationContract.address,
        oneHundredThousandDais
      );
      await smartDonationContract.investToken(
        daiAsBytes32,
        oneHundredThousandDais
      );

      const donorInvestmentPool = await smartDonationContract.investmentPools(
        donor.address
      );

      const investmentPoolBalanceBeforeDonation = await daiContract.balanceOf(
        donorInvestmentPool
      );

      await smartDonationContract.donateTokensGeneratedInterests(donees);

      const investmentPoolBalanceAfterDonation = await daiContract.balanceOf(
        donorInvestmentPool
      );

      expect(investmentPoolBalanceAfterDonation).to.be.equals(
        investmentPoolBalanceBeforeDonation
      );
    });

    it("Should not be able to donate token generated interests without an opened investment pool", async function () {
      const donees = [{ doneeAddress: trustedDonee1.address, percentage: 100 }];

      await expect(
        smartDonationContract.donateTokensGeneratedInterests(donees)
      ).to.be.revertedWith("Investment pool not found");
    });

    it("Should revert if there is an untrusted donee", async function () {
      const donees = [
        { doneeAddress: untrustedDonee.address, percentage: 100 },
      ];

      await smartDonationContract.openInvestmentPool();

      await daiContract.approve(smartDonationContract.address, oneThousandDais);
      await smartDonationContract.investToken(daiAsBytes32, oneThousandDais);

      await expect(
        smartDonationContract.donateTokensGeneratedInterests(donees)
      ).to.be.revertedWith("Only trusted donees are valid");
    });

    it("Should revert if there isn't any donee", async function () {
      await smartDonationContract.openInvestmentPool();

      await daiContract.approve(smartDonationContract.address, oneThousandDais);
      await smartDonationContract.investToken(daiAsBytes32, oneThousandDais);

      await expect(
        smartDonationContract.donateTokensGeneratedInterests([])
      ).to.be.revertedWith("There must be at least one donee");
    });

    it("Should revert if no interests where generated", async function () {
      const donees = [{ doneeAddress: trustedDonee1.address, percentage: 100 }];

      await smartDonationContract.openInvestmentPool();

      await expect(
        smartDonationContract.donateTokensGeneratedInterests(donees)
      ).to.be.revertedWith("No generated interests");
    });

    it("Should revert if a donee's percentage is 0", async function () {
      const donees = [{ doneeAddress: trustedDonee1.address, percentage: 0 }];

      await smartDonationContract.openInvestmentPool();

      await daiContract.approve(smartDonationContract.address, oneThousandDais);
      await smartDonationContract.investToken(daiAsBytes32, oneThousandDais);

      await expect(
        smartDonationContract.donateTokensGeneratedInterests(donees)
      ).to.be.revertedWith("Percentage must be between 1-100");
    });

    it("Should revert if a donee's percentage is more than 100", async function () {
      const donees = [{ doneeAddress: trustedDonee1.address, percentage: 101 }];

      await smartDonationContract.openInvestmentPool();

      await daiContract.approve(smartDonationContract.address, oneThousandDais);
      await smartDonationContract.investToken(daiAsBytes32, oneThousandDais);

      await expect(
        smartDonationContract.donateTokensGeneratedInterests(donees)
      ).to.be.revertedWith("Percentage must be between 1-100");
    });

    it("Should revert if the sum of donee's percentage is less than 100", async function () {
      const donees = [
        { doneeAddress: trustedDonee1.address, percentage: 45 },
        { doneeAddress: trustedDonee2.address, percentage: 45 },
        { doneeAddress: trustedDonee3.address, percentage: 9 },
      ];

      await smartDonationContract.openInvestmentPool();

      await daiContract.approve(
        smartDonationContract.address,
        oneHundredThousandDais
      );
      await smartDonationContract.investToken(
        daiAsBytes32,
        oneHundredThousandDais
      );

      await expect(
        smartDonationContract.donateTokensGeneratedInterests(donees)
      ).to.be.revertedWith("Total percentage must be 100");
    });

    it("Should revert if the sum of donee's percentage is more than 100", async function () {
      const donees = [
        { doneeAddress: trustedDonee1.address, percentage: 50 },
        { doneeAddress: trustedDonee2.address, percentage: 50 },
        { doneeAddress: trustedDonee3.address, percentage: 1 },
      ];

      await smartDonationContract.openInvestmentPool();

      await daiContract.approve(
        smartDonationContract.address,
        oneHundredThousandDais
      );
      await smartDonationContract.investToken(
        daiAsBytes32,
        oneHundredThousandDais
      );

      await smartDonationContract.connect(donor2).openInvestmentPool();

      await daiContract
        .connect(donor2)
        .approve(smartDonationContract.address, oneHundredThousandDais);
      await smartDonationContract
        .connect(donor2)
        .investToken(daiAsBytes32, oneHundredThousandDais);

      await expect(
        smartDonationContract.donateTokensGeneratedInterests(donees)
      ).to.be.revertedWith("Total percentage must be 100");
    });
  });
});