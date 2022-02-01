import { task } from "hardhat/config";
import { tokenConfigs } from "./tokenConfigs";

task(
  "invest",
  "Invest token to SmartDonation contract. Available Tokens: DAI-USDC-USDT."
)
  .addParam("contract", "The SmartDonation contract address.")
  .addParam("address", "The address where the investment come from.")
  .addParam("token", "The token to be invested.")
  .addParam(
    "amountnodecimals",
    "The amount of the token to be invested (without considering decimals)."
  )
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const { contract, address, token, amountnodecimals } = taskArgs;
    const { tokenAddress, cTokenAddress, decimals } = tokenConfigs[token];
    if (!tokenAddress) {
      throw new Error(`Unsupported token: ${token}`);
    }

    console.log(`Investing ${amountnodecimals} ${token} from ${address}...`);

    const amount = ethers.utils.parseUnits(
      amountnodecimals.toString(),
      decimals
    );

    const signer = await ethers.getSigner(address);

    const tokenContract = await ethers.getContractAt("IERC20", tokenAddress);
    await tokenContract.connect(signer).approve(contract, amount, {
      gasLimit: 2100000,
    });

    const smartDonationContract = await hre.ethers.getContractAt(
      "SmartDonation",
      contract
    );

    const balance = await tokenContract.balanceOf(address);

    if (balance.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    await smartDonationContract
      .connect(signer)
      .investToken(ethers.utils.formatBytes32String(token), amount);

    const cTokenContract = await ethers.getContractAt("CERC20", cTokenAddress);
    await cTokenContract.connect(signer).accrueInterest();

    console.log("Done!");
  });
