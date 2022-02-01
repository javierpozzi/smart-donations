import { BigNumber, BigNumberish } from "ethers";
import { ethers } from "hardhat";

export function cTokenToToken(
  cTokenBalance: BigNumber,
  exchangeRate: BigNumber
) {
  return cTokenBalance.mul(exchangeRate).div(BigNumber.from(10).pow(18));
}

export function parseDaiUnits(amount: BigNumberish) {
  return ethers.utils.parseUnits(amount.toString(), process.env.DAI_DECIMALS!);
}

export function parseUsdcUnits(amount: BigNumberish) {
  return ethers.utils.parseUnits(amount.toString(), process.env.USDC_DECIMALS!);
}

export function parseUsdtUnits(amount: BigNumberish) {
  return ethers.utils.parseUnits(amount.toString(), process.env.USDT_DECIMALS!);
}

export async function seedDAI(toAddress: string, amount: BigNumberish) {
  await transferERC20Token(
    process.env.DAI_CONTRACT_ADDRESS!,
    process.env.DAI_WHALE_ADDRESS!,
    toAddress,
    amount
  );
}

export async function seedUSDC(toAddress: string, amount: BigNumberish) {
  await transferERC20Token(
    process.env.USDC_CONTRACT_ADDRESS!,
    process.env.USDC_WHALE_ADDRESS!,
    toAddress,
    amount
  );
}

export async function seedUSDT(toAddress: string, amount: BigNumberish) {
  await transferERC20Token(
    process.env.USDT_CONTRACT_ADDRESS!,
    process.env.USDT_WHALE_ADDRESS!,
    toAddress,
    amount
  );
}

async function transferERC20Token(
  erc20ContractAddress: string,
  fromAddress: string,
  toAddress: string,
  amount: BigNumberish
) {
  const hre = require("hardhat");
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [fromAddress],
  });

  const signer = await ethers.getSigner(fromAddress);

  const erc20Contract = await ethers.getContractAt(
    "IERC20",
    erc20ContractAddress
  );

  await erc20Contract.connect(signer).transfer(toAddress, amount, {
    gasLimit: 2100000,
  });
}
