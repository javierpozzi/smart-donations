import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { CERC20, IERC20, InvestmentPool } from "../typechain";
import { cTokenToToken, parseDaiUnits, seedDAI } from "./utils/ERC20Utils";

describe("Investment Pool", function () {
  const daiAsBytes32 = ethers.utils.formatBytes32String("DAI");
  const usdcAsBytes32 = ethers.utils.formatBytes32String("USDC");
  const oneThousandDais = parseDaiUnits(1000);
  const twoThousandDais = parseDaiUnits(2000);
  const oneHundredThousandDais = parseDaiUnits(100000);

  let investmentPoolContract: InvestmentPool;
  let cDaiContract: CERC20;
  let daiContract: IERC20;
  let cUsdcContract: CERC20;
  let usdcContract: IERC20;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let accounts: SignerWithAddress[];

  before(async () => {
    cDaiContract = await ethers.getContractAt(
      "CERC20",
      process.env.COMPOUND_DAI_CONTRACT_ADDRESS!
    );
    daiContract = await ethers.getContractAt(
      "IERC20",
      process.env.DAI_CONTRACT_ADDRESS!
    );
    cUsdcContract = await ethers.getContractAt(
      "CERC20",
      process.env.COMPOUND_USDC_CONTRACT_ADDRESS!
    );
    usdcContract = await ethers.getContractAt(
      "IERC20",
      process.env.USDC_CONTRACT_ADDRESS!
    );
    accounts = await ethers.getSigners();
    [, investor1, investor2] = accounts;
  });

  beforeEach(async function () {
    const InvestmentPool = await ethers.getContractFactory("InvestmentPool");
    investmentPoolContract = await InvestmentPool.deploy([
      {
        symbol: daiAsBytes32,
        tokenAddress: daiContract.address,
        cTokenAddress: cDaiContract.address,
      },
      {
        symbol: usdcAsBytes32,
        tokenAddress: usdcContract.address,
        cTokenAddress: cUsdcContract.address,
      },
    ]);
    await investmentPoolContract.deployed();
    await seedDAI(investor1.address, oneHundredThousandDais);
    await seedDAI(investor2.address, oneHundredThousandDais);
  });

  describe("Invest token", function () {
    it("Should add similar token balance on cToken after investment", async function () {
      const cDaiBalanceBefore = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );
      const exchangeRateStoredBefore = await cDaiContract.exchangeRateStored();
      const cDaiBalanceInDaiBefore = cTokenToToken(
        cDaiBalanceBefore,
        exchangeRateStoredBefore
      );

      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, oneThousandDais);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        oneThousandDais
      );

      const cDaiBalanceAfter = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );
      const exchangeRateStoredAfter = await cDaiContract.exchangeRateStored();
      const cDaiBalanceInDaiAfter = cTokenToToken(
        cDaiBalanceAfter,
        exchangeRateStoredAfter
      );

      expect(cDaiBalanceInDaiAfter.sub(cDaiBalanceInDaiBefore)).to.be.closeTo(
        oneThousandDais,
        1e10
      );
    });

    it("Should be able to get invested tokens", async function () {
      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, oneThousandDais);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        oneThousandDais
      );

      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, twoThousandDais);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        twoThousandDais
      );

      const investedDai = await investmentPoolContract.getTokenInvestedAmount(
        investor1.address,
        daiAsBytes32
      );

      expect(investedDai).to.be.equals(oneThousandDais.add(twoThousandDais));
    });

    it("Should equals the sum of cTokenBalance of every user with the true cToken balance of the investment pool contract", async function () {
      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, oneThousandDais);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        oneThousandDais
      );

      await daiContract
        .connect(investor2)
        .transfer(investmentPoolContract.address, twoThousandDais);
      await investmentPoolContract.investToken(
        investor2.address,
        daiAsBytes32,
        twoThousandDais
      );

      const tokenPoolInvestor1 = await investmentPoolContract.tokenPools(
        investor1.address,
        daiAsBytes32
      );
      const tokenPoolInvestor2 = await investmentPoolContract.tokenPools(
        investor2.address,
        daiAsBytes32
      );

      const cTokenBalance = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );

      expect(cTokenBalance).to.be.equals(
        tokenPoolInvestor1.cTokenBalance.add(tokenPoolInvestor2.cTokenBalance)
      );
    });

    it("Should not be possible to invest more token than owned", async function () {
      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, oneThousandDais.sub(1));
      await expect(
        investmentPoolContract.investToken(
          investor1.address,
          daiAsBytes32,
          oneThousandDais
        )
      ).to.be.revertedWith("Dai/insufficient-balance");
    });

    it("Should not be able to invest on a token that is not on the invertible tokens list", async function () {
      await expect(
        investmentPoolContract.investToken(
          investor1.address,
          ethers.utils.formatBytes32String("INVALID-TOKEN"),
          ethers.utils.parseUnits("10", 18)
        )
      ).to.be.revertedWith("Invalid token symbol");
    });

    it("Should not be possible to invest 0 tokens", async function () {
      await expect(
        investmentPoolContract.investToken(investor1.address, daiAsBytes32, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should only be possible to invest by owner", async function () {
      await expect(
        investmentPoolContract
          .connect(investor1)
          .investToken(investor1.address, daiAsBytes32, oneThousandDais)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Redeem token generated interests", function () {
    it("Should only redeem generated interests, adding them to the investment pool token balance", async function () {
      const totalInvested = oneHundredThousandDais;

      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, totalInvested);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        totalInvested
      );

      const cDaiBalanceBeforeRedeem = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );

      await investmentPoolContract.redeemTokenGeneratedInterests(
        investor1.address,
        daiAsBytes32
      );

      const cDaiBalanceAfterRedeem = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );
      const exchangeRateStoredAfterRedeem =
        await cDaiContract.exchangeRateStored();

      const daiGeneratedInterests = cTokenToToken(
        cDaiBalanceBeforeRedeem.sub(cDaiBalanceAfterRedeem),
        exchangeRateStoredAfterRedeem
      );

      const daiBalanceAfterRedeem = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      expect(daiGeneratedInterests).to.be.closeTo(daiBalanceAfterRedeem, 1e10);
    });

    it("Should not redeem other's generated interests or investment", async function () {
      const investor1Investment = oneThousandDais;
      const investor2Investment = twoThousandDais;

      await daiContract
        .connect(investor2)
        .transfer(investmentPoolContract.address, investor2Investment);
      await investmentPoolContract.investToken(
        investor2.address,
        daiAsBytes32,
        investor2Investment
      );

      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, investor1Investment);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        investor1Investment
      );

      await investmentPoolContract.redeemTokenGeneratedInterests(
        investor1.address,
        daiAsBytes32
      );

      const cDaiBalance = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );
      const exchangeRateStored = await cDaiContract.exchangeRateStored();
      const cDaiBalanceInDai = cTokenToToken(cDaiBalance, exchangeRateStored);

      const daiGeneratedInterestsInvestor2 =
        await investmentPoolContract.getTokenGeneratedInterestsStored(
          investor2.address,
          daiAsBytes32
        );

      expect(cDaiBalanceInDai).to.be.closeTo(
        investor1Investment
          .add(investor2Investment)
          .add(daiGeneratedInterestsInvestor2),
        1e10
      );
    });

    it("Should add generated interests tokens to contract balance after redeem", async function () {
      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, oneHundredThousandDais);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        oneHundredThousandDais
      );

      const balanceAfterInvestment = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      await investmentPoolContract.redeemTokenGeneratedInterests(
        investor1.address,
        daiAsBytes32
      );

      const generatedInterests = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      expect(balanceAfterInvestment).to.be.equals(0);
      expect(generatedInterests).to.be.gt(0);
    });

    it("Should not redeem any interest if nothing was invested", async function () {
      const balanceBefore = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      await investmentPoolContract.redeemTokenGeneratedInterests(
        investor1.address,
        daiAsBytes32
      );

      const balanceAfter = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      expect(balanceAfter).to.be.equals(balanceBefore);
    });

    it("Should not be able to redeem a token that is not on the invertible tokens list", async function () {
      await expect(
        investmentPoolContract.redeemTokenGeneratedInterests(
          investor1.address,
          ethers.utils.formatBytes32String("INVALID-TOKEN")
        )
      ).to.be.revertedWith("Invalid token symbol");
    });

    it("Should only be possible to redeem generated interests by owner", async function () {
      await expect(
        investmentPoolContract
          .connect(investor1)
          .redeemTokenGeneratedInterests(investor1.address, daiAsBytes32)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Transfer token", function () {
    it("Should increase receiver balance after transfer", async function () {
      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, oneThousandDais);

      const balanceBeforeTransfer = await daiContract.balanceOf(
        investor2.address
      );

      await investmentPoolContract.transferToken(
        daiAsBytes32,
        investor2.address,
        oneThousandDais
      );

      const balanceAfterTransfer = await daiContract.balanceOf(
        investor2.address
      );

      expect(balanceAfterTransfer).to.be.equals(
        balanceBeforeTransfer.add(oneThousandDais)
      );
    });

    it("Should decrease sender balance after transfer", async function () {
      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, oneThousandDais);

      const balanceBeforeTransfer = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      await investmentPoolContract.transferToken(
        daiAsBytes32,
        investor2.address,
        oneThousandDais
      );

      const balanceAfterTransfer = await daiContract.balanceOf(
        investmentPoolContract.address
      );

      expect(balanceBeforeTransfer).to.be.equals(
        balanceAfterTransfer.add(oneThousandDais)
      );
    });

    it("Should not be able to transfer a token that is not on the invertible tokens list", async function () {
      await expect(
        investmentPoolContract.transferToken(
          ethers.utils.formatBytes32String("INVALID-TOKEN"),
          investor1.address,
          ethers.utils.parseUnits("10", 18)
        )
      ).to.be.revertedWith("Invalid token symbol");
    });

    it("Should only be possible to transfer token by owner", async function () {
      await expect(
        investmentPoolContract
          .connect(investor1)
          .transferToken(daiAsBytes32, investor1.address, oneThousandDais)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Get token generated interests", function () {
    it("Should get token generated interests", async function () {
      const totalInvested = oneHundredThousandDais;

      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, totalInvested);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        totalInvested
      );

      await cDaiContract.accrueInterest();

      const cDaiBalance = await cDaiContract.balanceOf(
        investmentPoolContract.address
      );

      const exchangeRateStored = await cDaiContract.exchangeRateStored();

      const daiGeneratedInterestsCalculated = cTokenToToken(
        cDaiBalance,
        exchangeRateStored
      ).sub(totalInvested);

      const daiGeneratedInterestsFromContract =
        await investmentPoolContract.getTokenGeneratedInterestsStored(
          investor1.address,
          daiAsBytes32
        );

      expect(daiGeneratedInterestsFromContract).to.be.closeTo(
        daiGeneratedInterestsCalculated,
        1e10
      );
    });

    it("Should not be able to get generated interests of a token that is not on the invertible tokens list", async function () {
      await expect(
        investmentPoolContract.getTokenGeneratedInterestsStored(
          investor1.address,
          ethers.utils.formatBytes32String("INVALID-TOKEN")
        )
      ).to.be.revertedWith("Invalid token symbol");
    });

    it("Should reduce token generated interests after redeem", async function () {
      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, oneHundredThousandDais);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        oneHundredThousandDais
      );

      await cDaiContract.accrueInterest();

      const generatedInterestsBefore =
        await investmentPoolContract.getTokenGeneratedInterestsStored(
          investor1.address,
          daiAsBytes32
        );

      await investmentPoolContract.redeemTokenGeneratedInterests(
        investor1.address,
        daiAsBytes32
      );

      const generatedInterestsAfter =
        await investmentPoolContract.getTokenGeneratedInterestsStored(
          investor1.address,
          daiAsBytes32
        );

      expect(generatedInterestsBefore).to.be.gt(generatedInterestsAfter);
      expect(generatedInterestsAfter).to.be.closeTo(BigNumber.from(0), 1e10);
    });

    it("Should increase token generated interests with each investment", async function () {
      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, oneThousandDais);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        oneThousandDais
      );

      await cDaiContract.accrueInterest();

      const generatedInterestsFirstInv =
        await investmentPoolContract.getTokenGeneratedInterestsStored(
          investor1.address,
          daiAsBytes32
        );

      await daiContract
        .connect(investor1)
        .transfer(investmentPoolContract.address, oneThousandDais);
      await investmentPoolContract.investToken(
        investor1.address,
        daiAsBytes32,
        oneThousandDais
      );

      await cDaiContract.accrueInterest();

      const generatedInterestsSecondInv =
        await investmentPoolContract.getTokenGeneratedInterestsStored(
          investor1.address,
          daiAsBytes32
        );

      expect(generatedInterestsSecondInv).to.be.gt(
        generatedInterestsFirstInv.mul(2)
      );
    });
  });
});
