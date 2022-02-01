import { task } from "hardhat/config";
import { tokenConfigs } from "./tokenConfigs";

const amountWithoutDecimals = 100000;

task(
  "seedAddress",
  `Seed an address with ${amountWithoutDecimals} of available tokens.`
)
  .addParam("address", "The address to be funded.")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const { address } = taskArgs;

    console.log(`Seeding ${address}...`);

    for (const token in tokenConfigs) {
      const { tokenAddress, whaleAddress, decimals } = tokenConfigs[token];

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [whaleAddress],
      });
      const signer = await ethers.getSigner(whaleAddress);

      const tokenContract = await ethers.getContractAt("IERC20", tokenAddress);

      const amount = ethers.utils.parseUnits(
        amountWithoutDecimals.toString(),
        decimals
      );

      await tokenContract.connect(signer).transfer(address, amount, {
        gasLimit: 2100000,
      });
      const balance = await tokenContract.balanceOf(address);

      const formattedAmount = `${amountWithoutDecimals}.${"0".repeat(
        decimals
      )}`;

      console.log(`Seeded ${formattedAmount} ${token}. Balance: ${balance}`);
    }
    console.log("Done!");
  });
