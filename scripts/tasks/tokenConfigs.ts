import * as dotenv from "dotenv";

dotenv.config();

export const tokenConfigs: any = {
  DAI: {
    tokenAddress: process.env.DAI_CONTRACT_ADDRESS!,
    cTokenAddress: process.env.COMPOUND_DAI_CONTRACT_ADDRESS!,
    whaleAddress: process.env.DAI_WHALE_ADDRESS!,
    decimals: process.env.DAI_DECIMALS!,
  },
  USDC: {
    tokenAddress: process.env.USDC_CONTRACT_ADDRESS!,
    cTokenAddress: process.env.COMPOUND_USDC_CONTRACT_ADDRESS!,
    whaleAddress: process.env.USDC_WHALE_ADDRESS!,
    decimals: process.env.USDC_DECIMALS!,
  },
  USDT: {
    tokenAddress: process.env.USDT_CONTRACT_ADDRESS!,
    cTokenAddress: process.env.COMPOUND_USDT_CONTRACT_ADDRESS!,
    whaleAddress: process.env.USDT_WHALE_ADDRESS!,
    decimals: process.env.USDT_DECIMALS!,
  },
};
