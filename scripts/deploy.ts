import { ethers } from "hardhat";
import {
  deployInvestmentPool,
  deploySmartDonation,
  deployTrustedDoneeManager,
  populateTrustedDoneeManager,
} from "./deployHelper";

const useDummyData = process.env.DUMMY_DATA! ?? 0;

async function main() {
  console.log("Deploying TrustedDoneeManager...");
  const trustedDoneesManagerContract = await deployTrustedDoneeManager();

  console.log("Deploying InvestmentPool...");
  const investmentPoolContract = await deployInvestmentPool();

  console.log("Deploying SmartDonation...");
  const smartDonationContract = await deploySmartDonation(
    trustedDoneesManagerContract,
    investmentPoolContract
  );

  console.log("SmartDonation deployed to:", smartDonationContract.address);
  console.log("InvestmentPool deployed to:", investmentPoolContract.address);
  console.log(
    "TrustedDoneeManager deployed to:",
    trustedDoneesManagerContract.address
  );

  const invertibleTokenSymbols =
    await investmentPoolContract.getInvertibleTokenSymbols();
  console.log(
    "Invertible tokens available:",
    invertibleTokenSymbols.map((symbol) =>
      ethers.utils.parseBytes32String(symbol)
    )
  );

  if (useDummyData) {
    console.log("Creating dummy donees...");
    await populateTrustedDoneeManager(trustedDoneesManagerContract);
    console.log("Done!");
  }
  console.log("Deployment complete!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
