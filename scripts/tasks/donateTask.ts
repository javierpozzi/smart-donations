import { task } from "hardhat/config";
import { tokenConfigs } from "./tokenConfigs";

task("donate", "Donate generated interests to trusted donees.")
  .addParam("contract", "The SmartDonation contract address.")
  .addParam("address", "The address that make the donation.")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const { contract, address } = taskArgs;

    console.log(`Donating from ${address}...`);

    const signer = await ethers.getSigner(address);

    const smartDonationContract = await hre.ethers.getContractAt(
      "SmartDonation",
      contract
    );

    const trustedDonees = await smartDonationContract
      .connect(signer)
      .getTrustedDonees();

    const donatedDonees = [
      {
        doneeAddress: trustedDonees[0],
        percentage: 60,
      },
      {
        doneeAddress: trustedDonees[1],
        percentage: 40,
      },
    ];

    console.log("Donating to", ...donatedDonees.map((d) => d.doneeAddress));

    await smartDonationContract
      .connect(signer)
      .donateTokensGeneratedInterests(donatedDonees);

    console.log("Done!");

    for (const token in tokenConfigs) {
      const { tokenAddress } = tokenConfigs[token];

      const tokenContract = await ethers.getContractAt("IERC20", tokenAddress);

      for (const donatedDonee of donatedDonees) {
        const doneeBalance = await tokenContract
          .connect(signer)
          .balanceOf(donatedDonee.doneeAddress);
        if (!doneeBalance.isZero()) {
          console.log(
            `${token} Balance of ${donatedDonee.doneeAddress}: ${doneeBalance}`
          );
        }
      }
    }
  });
