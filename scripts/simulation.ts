import { ethers } from "hardhat";
import {
  deployInvestmentPool,
  deploySmartDonation,
  deployTrustedDoneeManager,
  populateTrustedDoneeManager,
} from "./deployHelper";

async function main() {
  const hre = require("hardhat");

  console.log("Deploying contracts...");
  const smartDonationContract = await deployContracts();

  const [signer] = await ethers.getSigners();
  const address = signer.address;
  const contract = smartDonationContract.address;
  await hre.run("simulation", { contract, address });
}

async function deployContracts() {
  const trustedDoneesManagerContract = await deployTrustedDoneeManager();

  const investmentPoolContract = await deployInvestmentPool();

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

  console.log("Creating dummy donees...");
  await populateTrustedDoneeManager(trustedDoneesManagerContract);

  console.log("Deployment complete!");

  return smartDonationContract;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
