import { BigNumber } from "ethers";
import { ethers } from "hardhat";

export function addDecimalsToDai(amount: number) {
  return addDecimalsToToken(amount, 18);
}

export function addDecimalsToToken(amount: number, decimals: number) {
  return BigNumber.from(10).pow(decimals).mul(amount);
}

export async function seedDAI(toAddress: string, amount: number) {
  await transferERC20Token(
    process.env.DAI_CONTRACT_ADDRESS!,
    process.env.DAI_WHALE_ADDRESS!,
    toAddress,
    amount
  );
}

async function transferERC20Token(
  erc20ContractAddress: string,
  fromAddress: string,
  toAddress: string,
  amount: number
) {
  const erc20Contract = await ethers.getContractAt(
    "ERC20",
    erc20ContractAddress
  );

  const hre = require("hardhat");
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [fromAddress],
  });

  const decimals = await erc20Contract.decimals();

  const tokensToTransfer = addDecimalsToToken(amount, decimals);

  const signer = await ethers.getSigner(fromAddress);

  await erc20Contract.connect(signer).transfer(toAddress, tokensToTransfer, {
    gasLimit: 2100000,
  });
}
