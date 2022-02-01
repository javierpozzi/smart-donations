import { task } from "hardhat/config";

task(
  "simulation",
  "Simulate an scenario where an address is seeded with tokens, invest them and then donate the interests to donees"
)
  .addParam("contract", "The SmartDonation contract address.")
  .addParam("address", "The address that is used for the simulation.")
  .setAction(async (taskArgs, hre) => {
    const { contract, address } = taskArgs;

    console.log("Starting simulation...");

    console.log("Running task seedAddress");
    console.log("-----------------------------------------");
    await hre.run("seedAddress", { address });
    console.log("-----------------------------------------");

    console.log("Running task invest with USDC");
    console.log("-----------------------------------------");
    const investUsdcArgs = {
      contract,
      address,
      token: "USDC",
      amountnodecimals: "3000",
    };
    await hre.run("invest", investUsdcArgs);
    console.log("-----------------------------------------");

    console.log("Running task invest with DAI");
    console.log("-----------------------------------------");
    const investDaiArgs = {
      contract,
      address,
      token: "DAI",
      amountnodecimals: "5000",
    };
    await hre.run("invest", investDaiArgs);
    console.log("-----------------------------------------");

    console.log("Running task interests");
    console.log("-----------------------------------------");
    await hre.run("interests", { contract, address });
    console.log("-----------------------------------------");

    console.log("Running task donate");
    console.log("-----------------------------------------");
    await hre.run("donate", { contract, address });
    console.log("-----------------------------------------");

    console.log("Simulation Finished!");
  });
