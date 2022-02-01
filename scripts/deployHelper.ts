import { ethers } from "hardhat";
import { InvestmentPool, TrustedDoneesManager } from "../typechain";

export const invertibleTokens = [
  {
    symbol: ethers.utils.formatBytes32String("DAI"),
    tokenAddress: process.env.DAI_CONTRACT_ADDRESS!,
    cTokenAddress: process.env.COMPOUND_DAI_CONTRACT_ADDRESS!,
  },
  {
    symbol: ethers.utils.formatBytes32String("USDC"),
    tokenAddress: process.env.USDC_CONTRACT_ADDRESS!,
    cTokenAddress: process.env.COMPOUND_USDC_CONTRACT_ADDRESS!,
  },
  {
    symbol: ethers.utils.formatBytes32String("USDT"),
    tokenAddress: process.env.USDT_CONTRACT_ADDRESS!,
    cTokenAddress: process.env.COMPOUND_USDT_CONTRACT_ADDRESS!,
  },
];

export async function deployTrustedDoneeManager() {
  const TrustedDoneesManager = await ethers.getContractFactory(
    "TrustedDoneesManager"
  );
  const trustedDoneesManagerContract = await TrustedDoneesManager.deploy();
  await trustedDoneesManagerContract.deployed();
  return trustedDoneesManagerContract;
}

export async function deployInvestmentPool() {
  const InvestmentPool = await ethers.getContractFactory("InvestmentPool");
  const investmentPoolContract = await InvestmentPool.deploy(invertibleTokens);
  await investmentPoolContract.deployed();
  return investmentPoolContract;
}

export async function deploySmartDonation(
  trustedDoneesManagerContract: TrustedDoneesManager,
  investmentPoolContract: InvestmentPool
) {
  const SmartDonation = await ethers.getContractFactory("SmartDonation");
  const smartDonationContract = await SmartDonation.deploy(
    trustedDoneesManagerContract.address,
    investmentPoolContract.address
  );
  await smartDonationContract.deployed();
  investmentPoolContract.transferOwnership(smartDonationContract.address);
  return smartDonationContract;
}

export async function populateTrustedDoneeManager(
  trustedDoneesManagerContract: TrustedDoneesManager
) {
  const accounts = await ethers.getSigners();
  await trustedDoneesManagerContract.addDonee(
    ethers.utils.formatBytes32String("Donee 1"),
    accounts[1].address
  );
  await trustedDoneesManagerContract.addDonee(
    ethers.utils.formatBytes32String("Donee 2"),
    accounts[2].address
  );
  await trustedDoneesManagerContract.addDonee(
    ethers.utils.formatBytes32String("Donee 3"),
    accounts[3].address
  );
  await trustedDoneesManagerContract.addDonee(
    ethers.utils.formatBytes32String("Donee 4"),
    accounts[4].address
  );
}
