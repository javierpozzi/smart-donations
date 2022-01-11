import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { CERC20, ERC20, InvestmentPool } from "../typechain";
import { addDecimalsToDai, seedDAI } from "./utils/ERC20Utils";

describe("Investment Pool", function () {
  let cDaiContract: CERC20;
  let daiContract: ERC20;
  let investmentPoolContract: InvestmentPool;
  let addrs: SignerWithAddress[];

  before(async () => {
    cDaiContract = await ethers.getContractAt(
      "CERC20",
      process.env.COMPOUND_DAI_CONTRACT_ADDRESS!
    );
    daiContract = await ethers.getContractAt(
      "ERC20",
      process.env.DAI_CONTRACT_ADDRESS!
    );
    addrs = await ethers.getSigners();
  });

  beforeEach(async function () {
    const InvestmentPool = await ethers.getContractFactory("InvestmentPool");
    investmentPoolContract = await InvestmentPool.deploy();
    await investmentPoolContract.deployed();
    await seedDAI(addrs[0].address, 1000);
  });

  it("Should have DAI similar balance on cDAI after investment", async function () {
    const amount = addDecimalsToDai(10);

    await daiContract.transfer(investmentPoolContract.address, amount);
    await investmentPoolContract.investToken(
      ethers.utils.formatBytes32String("DAI"),
      daiContract.address,
      cDaiContract.address,
      amount
    );

    const cDaiBalance = await cDaiContract.balanceOf(
      investmentPoolContract.address
    );
    const exchangeRateStored = await cDaiContract.exchangeRateStored();
    const cDaiBalanceInDai = cDaiBalance
      .mul(exchangeRateStored)
      .div(BigNumber.from(10).pow(18));

    expect(cDaiBalanceInDai).to.be.closeTo(amount, 1e10);

    // const cDaiBalance = await cDaiContract
    //   .connect(investmentPoolContract.address)
    //   .balanceOf(investmentPoolContract.address);

    // expect(cDaiBalance).to.be.equals(daiBalance);

    // await cDaiContract.accrueInterest();
  });

  it("Should not be possible to invest more DAI than owned", async function () {
    const amount = addDecimalsToDai(10);

    await expect(
      investmentPoolContract.investToken(
        ethers.utils.formatBytes32String("DAI"),
        daiContract.address,
        cDaiContract.address,
        amount
      )
    ).to.be.revertedWith("Dai/insufficient-balance");
  });

  it("Should be able to show your total invested DAI", async function () {
    const amount = addDecimalsToDai(10);
    const amount2 = addDecimalsToDai(15);

    await daiContract.transfer(investmentPoolContract.address, amount);
    await investmentPoolContract.investToken(
      ethers.utils.formatBytes32String("DAI"),
      daiContract.address,
      cDaiContract.address,
      amount
    );

    await daiContract.transfer(investmentPoolContract.address, amount2);
    await investmentPoolContract.investToken(
      ethers.utils.formatBytes32String("DAI"),
      daiContract.address,
      cDaiContract.address,
      amount2
    );

    const totalInvestedDai = await investmentPoolContract.totalInvestedTokens(
      ethers.utils.formatBytes32String("DAI")
    );

    expect(totalInvestedDai).to.be.equals(amount.add(amount2));
  });

  it("Should only be possible to invest by owner", async function () {
    const amount = addDecimalsToDai(10);
    const otherAddr = addrs[1];

    await expect(
      investmentPoolContract
        .connect(otherAddr)
        .investToken(
          ethers.utils.formatBytes32String("DAI"),
          daiContract.address,
          cDaiContract.address,
          amount
        )
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  // it("Only owner should add eth", async function () {
  //   const amount = ethers.utils.parseEther("5.0");

  //   await expect(
  //     donorContract.connect(otherAddr).addEth({ value: amount })
  //   ).to.be.revertedWith("Ownable: caller is not the owner");
  // });

  // it("Should add donee with totalDonated on 0", async function () {
  //   const donee = { name: donee1Name, address: doneeAddr1.address };

  //   await donorContract.addDonee(donee.name, donee.address);

  //   const createdDonee = await donorContract.getDonee(donee.address);

  //   expect(createdDonee.totalDonated).to.be.equals(0);
  // });

  // it("Should disabled donee", async function () {
  //   const donee = { name: donee1Name, address: doneeAddr1.address };

  //   await donorContract.addDonee(donee.name, donee.address);

  //   await donorContract.disableDonee(donee.address);

  //   const createdDonee = await donorContract.getDonee(donee.address);

  //   expect(createdDonee.enabled).to.be.false;
  // });

  // it("Should enable donee", async function () {
  //   const donee = { name: donee1Name, address: doneeAddr1.address };

  //   await donorContract.addDonee(donee.name, donee.address);

  //   await donorContract.disableDonee(donee.address);

  //   await donorContract.enableDonee(donee.address);

  //   const createdDonee = await donorContract.getDonee(donee.address);

  //   expect(createdDonee.enabled).to.be.true;
  // });

  // it("Should not add donee with same address", async function () {
  //   const donee = { name: donee1Name, address: doneeAddr1.address };

  //   await donorContract.addDonee(donee.name, donee.address);

  //   await expect(
  //     donorContract.addDonee(donee.name, donee.address)
  //   ).to.be.revertedWith("Donee already exists");
  // });

  // it("Should not add donee with name longer than 32", async function () {
  //   const donee = { name: "a".repeat(33), address: doneeAddr1.address };

  //   await expect(
  //     donorContract.addDonee(donee.name, donee.address)
  //   ).to.be.revertedWith("Name must be between 0-32 bytes");
  // });

  // it("Should not add donee with empty name", async function () {
  //   const donee = { name: "", address: doneeAddr1.address };

  //   await expect(
  //     donorContract.addDonee(donee.name, donee.address)
  //   ).to.be.revertedWith("Name must be between 0-32 bytes");
  // });

  // it("Should not add donee with address 0", async function () {
  //   const donee = {
  //     name: donee1Name,
  //     address: "0x0000000000000000000000000000000000000000",
  //   };

  //   await expect(
  //     donorContract.addDonee(donee.name, donee.address)
  //   ).to.be.revertedWith("Address cannot be 0");
  // });
});
