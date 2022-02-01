import { task } from "hardhat/config";
import { tokenConfigs } from "./tokenConfigs";

task("investedamount", "Get the invested amount of an address.")
  .addParam("contract", "The SmartDonation contract address.")
  .addParam("address", "The address that made the investements.")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const { contract, address } = taskArgs;

    console.log(`Getting invested amounts of ${address}...`);

    const signer = await ethers.getSigner(address);

    const smartDonationContract = await hre.ethers.getContractAt(
      "SmartDonation",
      contract
    );

    for (const token in tokenConfigs) {
      const investedAmount = await smartDonationContract
        .connect(signer)
        .getTokenInvestedAmount(ethers.utils.formatBytes32String(token));

      console.log(`Invested amount of ${token}: ${investedAmount}`);
    }
  });
