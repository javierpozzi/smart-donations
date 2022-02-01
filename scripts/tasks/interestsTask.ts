import { task } from "hardhat/config";
import { tokenConfigs } from "./tokenConfigs";

task("interests", "Get the generated interests of an address.")
  .addParam("contract", "The SmartDonation contract address.")
  .addParam("address", "The address that has generated interests.")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const { contract, address } = taskArgs;

    console.log(`Getting generated interests of ${address}...`);

    const signer = await ethers.getSigner(address);

    const smartDonationContract = await hre.ethers.getContractAt(
      "SmartDonation",
      contract
    );

    for (const token in tokenConfigs) {
      const investedAmount = await smartDonationContract
        .connect(signer)
        .getTokenGeneratedInterests(ethers.utils.formatBytes32String(token));

      console.log(`Interests of ${token}: ${investedAmount}`);
    }
  });
