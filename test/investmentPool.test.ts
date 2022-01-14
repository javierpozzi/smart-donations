import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { CERC20, ERC20, InvestmentPool } from "../typechain";
import { parseDaiUnits, seedDAI, cTokenToToken } from "./utils/ERC20Utils";

describe("Investment Pool", function () {
  const daiAsBytes32 = ethers.utils.formatBytes32String("DAI");
  const oneThousandDais = parseDaiUnits(1000);
  const twoThousandDais = parseDaiUnits(2000);
  const oneHundredThousandDais = parseDaiUnits(100000);

  let investmentPoolContract: InvestmentPool;
  let cDaiContract: CERC20;
  let daiContract: ERC20;
  let cUsdcContract: CERC20;
  let owner: SignerWithAddress;
  let otherAddr: SignerWithAddress;
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
    accounts = await ethers.getSigners();
    [owner, otherAddr] = accounts;
  });

  beforeEach(async function () {
    const InvestmentPool = await ethers.getContractFactory("InvestmentPool");
    investmentPoolContract = await InvestmentPool.deploy();
    await investmentPoolContract.deployed();
    await seedDAI(owner.address, oneHundredThousandDais);
  });

  describe("Invest token", function () {
    it("Should have similar token balance on cToken after investment", async function () {
      await daiContract.transfer(
        investmentPoolContract.address,
        oneThousandDais
      );
      await investmentPoolContract.investToken(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address,
        oneThousandDais
      );

      const cDaiBalance = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );
      const exchangeRateStored = await cDaiContract.exchangeRateStored();
      const decimals = await daiContract.decimals();
      const cDaiBalanceInDai = cTokenToToken(
        cDaiBalance,
        exchangeRateStored,
        decimals
      );

      expect(cDaiBalanceInDai).to.be.closeTo(oneThousandDais, 1e10);
    });

    it("Should be able to show your total invested token", async function () {
      await daiContract.transfer(
        investmentPoolContract.address,
        oneThousandDais
      );
      await investmentPoolContract.investToken(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address,
        oneThousandDais
      );

      await daiContract.transfer(
        investmentPoolContract.address,
        twoThousandDais
      );
      await investmentPoolContract.investToken(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address,
        twoThousandDais
      );

      const totalInvestedDai = await investmentPoolContract.totalInvestedTokens(
        daiAsBytes32
      );

      expect(totalInvestedDai).to.be.equals(
        oneThousandDais.add(twoThousandDais)
      );
    });

    it("Should not be possible to invest more token than owned", async function () {
      await expect(
        investmentPoolContract.investToken(
          daiAsBytes32,
          daiContract.address,
          cDaiContract.address,
          oneThousandDais
        )
      ).to.be.revertedWith("Dai/insufficient-balance");
    });

    it("Should not be possible to invest 0 tokens", async function () {
      await expect(
        investmentPoolContract.investToken(
          daiAsBytes32,
          daiContract.address,
          cDaiContract.address,
          0
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should not be possible to invest to empty token address", async function () {
      await expect(
        investmentPoolContract.investToken(
          daiAsBytes32,
          "0x0000000000000000000000000000000000000000",
          cDaiContract.address,
          oneThousandDais
        )
      ).to.be.revertedWith("Token address cannot be 0");
    });

    it("Should not be possible to invest to empty cToken address", async function () {
      await expect(
        investmentPoolContract.investToken(
          daiAsBytes32,
          daiContract.address,
          "0x0000000000000000000000000000000000000000",
          oneThousandDais
        )
      ).to.be.revertedWith("cToken address cannot be 0");
    });

    it("Should revert if the token is not related to the cToken", async function () {
      await daiContract.transfer(
        investmentPoolContract.address,
        oneThousandDais
      );
      await expect(
        investmentPoolContract.investToken(
          daiAsBytes32,
          daiContract.address,
          cUsdcContract.address,
          oneThousandDais
        )
      ).to.be.revertedWith("Failed to mint");
    });

    it("Should only be possible to invest by owner", async function () {
      await expect(
        investmentPoolContract
          .connect(otherAddr)
          .investToken(
            daiAsBytes32,
            daiContract.address,
            cDaiContract.address,
            oneThousandDais
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Redeem token generated interests", function () {
    it("Should only redeem generated interests, adding them to the token balance", async function () {
      const totalInvested = oneHundredThousandDais;

      await daiContract.transfer(investmentPoolContract.address, totalInvested);
      await investmentPoolContract.investToken(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address,
        totalInvested
      );

      const cDaiBalanceBeforeRedeem = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );

      await investmentPoolContract.redeemTokenGeneratedInterests(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address
      );

      const cDaiBalanceAfterRedeem = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );
      const exchangeRateStoredAfterRedeem =
        await cDaiContract.exchangeRateStored();

      const decimals = await daiContract.decimals();

      const daiGeneratedInterests = cTokenToToken(
        cDaiBalanceBeforeRedeem.sub(cDaiBalanceAfterRedeem),
        exchangeRateStoredAfterRedeem,
        decimals
      );

      const daiBalanceAfterRedeem = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      expect(daiGeneratedInterests).to.be.closeTo(daiBalanceAfterRedeem, 1e10);
    });

    it("Should keep total invested in cToken balance after redeem generated interests", async function () {
      const totalInvested = oneHundredThousandDais;

      await daiContract.transfer(investmentPoolContract.address, totalInvested);
      await investmentPoolContract.investToken(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address,
        totalInvested
      );

      await investmentPoolContract.redeemTokenGeneratedInterests(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address
      );

      const cDaiBalance = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );
      const exchangeRateStored = await cDaiContract.exchangeRateStored();
      const decimals = await daiContract.decimals();
      const cDaiBalanceInDai = cTokenToToken(
        cDaiBalance,
        exchangeRateStored,
        decimals
      );

      expect(cDaiBalanceInDai).to.be.closeTo(totalInvested, 1e10);
    });

    it("Should add generated interests tokens to contract balance after redeem", async function () {
      await daiContract.transfer(
        investmentPoolContract.address,
        oneHundredThousandDais
      );
      await investmentPoolContract.investToken(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address,
        oneHundredThousandDais
      );

      const balanceAfterInvestment = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      await investmentPoolContract.redeemTokenGeneratedInterests(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address
      );

      const generatedInterests = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      expect(balanceAfterInvestment).to.be.equals(0);
      expect(generatedInterests).to.be.gt(0);
    });

    it("Should not redeem any interest if nothing was invested", async function () {
      await investmentPoolContract.redeemTokenGeneratedInterests(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address
      );

      const generatedInterests = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      expect(generatedInterests).to.be.equals(0);
    });

    it("Should only be possible to redeem generated interests by owner", async function () {
      await expect(
        investmentPoolContract
          .connect(otherAddr)
          .redeemTokenGeneratedInterests(
            daiAsBytes32,
            daiContract.address,
            cDaiContract.address
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Transfer token", function () {
    it("Should increase receiver balance after transfer", async function () {
      await daiContract.transfer(
        investmentPoolContract.address,
        oneThousandDais
      );

      const balanceBeforeTransfer = await daiContract.balanceOf(
        otherAddr.address
      );

      await investmentPoolContract.transferToken(
        daiContract.address,
        otherAddr.address,
        oneThousandDais
      );

      const balanceAfterTransfer = await daiContract.balanceOf(
        otherAddr.address
      );

      expect(balanceAfterTransfer).to.be.equals(
        balanceBeforeTransfer.add(oneThousandDais)
      );
    });

    it("Should decrease sender balance after transfer", async function () {
      await daiContract.transfer(
        investmentPoolContract.address,
        oneThousandDais
      );

      const balanceBeforeTransfer = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      await investmentPoolContract.transferToken(
        daiContract.address,
        otherAddr.address,
        oneThousandDais
      );

      const balanceAfterTransfer = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      expect(balanceBeforeTransfer).to.be.equals(
        balanceAfterTransfer.add(oneThousandDais)
      );
    });

    it("Should only be possible to transfer token by owner", async function () {
      await expect(
        investmentPoolContract
          .connect(otherAddr)
          .transferToken(
            daiContract.address,
            otherAddr.address,
            oneThousandDais
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  describe("Get token generated interests", function () {
    it("Should get token generated interests", async function () {
      const totalInvested = oneHundredThousandDais;

      await daiContract.transfer(investmentPoolContract.address, totalInvested);
      await investmentPoolContract.investToken(
        daiAsBytes32,
        daiContract.address,
        cDaiContract.address,
        totalInvested
      );

      await cDaiContract.accrueInterest();

      const cDaiBalance = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );

      const exchangeRateStored = await cDaiContract.exchangeRateStored();

      const decimals = await daiContract.decimals();

      const daiGeneratedInterestsCalculated = cTokenToToken(
        cDaiBalance,
        exchangeRateStored,
        decimals
      ).sub(totalInvested);

      const daiGeneratedInterestsFromContract =
        await investmentPoolContract.getTokenGeneratedInterestsStored(
          daiAsBytes32,
          daiContract.address,
          cDaiContract.address
        );

      expect(daiGeneratedInterestsFromContract).to.be.closeTo(
        daiGeneratedInterestsCalculated,
        1e10
      );
    });
  });
});
