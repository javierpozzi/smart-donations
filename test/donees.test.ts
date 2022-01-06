import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Donees__factory, Donees } from "../typechain";

describe("Donees", function () {
  let Donees: Donees__factory;
  let doneesContract: Donees;
  let doneeAddr1: SignerWithAddress;

  const donee1Name = "Donee 1";

  beforeEach(async function () {
    [doneeAddr1] = await ethers.getSigners();
    Donees = await ethers.getContractFactory("Donees");
    doneesContract = await Donees.deploy();
    await doneesContract.deployed();
  });

  it("Should add donee", async function () {
    const donee = { name: donee1Name, address: doneeAddr1.address };

    await doneesContract.addDonee(donee.name, donee.address);

    const createdDonee = await doneesContract.getDonee(donee.address);
    const createdDoneeName = ethers.utils.parseBytes32String(createdDonee.name);

    expect(createdDoneeName).to.be.equals(donee1Name);
  });

  it("Should add donee with enabled true", async function () {
    const donee = { name: donee1Name, address: doneeAddr1.address };

    await doneesContract.addDonee(donee.name, donee.address);

    const createdDonee = await doneesContract.getDonee(donee.address);

    expect(createdDonee.enabled).to.be.true;
  });

  it("Should add donee with totalDonated on 0", async function () {
    const donee = { name: donee1Name, address: doneeAddr1.address };

    await doneesContract.addDonee(donee.name, donee.address);

    const createdDonee = await doneesContract.getDonee(donee.address);

    expect(createdDonee.totalDonated).to.be.equals(0);
  });

  it("Should disabled donee", async function () {
    const donee = { name: donee1Name, address: doneeAddr1.address };

    await doneesContract.addDonee(donee.name, donee.address);

    await doneesContract.disableDonee(donee.address);

    const createdDonee = await doneesContract.getDonee(donee.address);

    expect(createdDonee.enabled).to.be.false;
  });

  it("Should enable donee", async function () {
    const donee = { name: donee1Name, address: doneeAddr1.address };

    await doneesContract.addDonee(donee.name, donee.address);

    await doneesContract.disableDonee(donee.address);

    await doneesContract.enableDonee(donee.address);

    const createdDonee = await doneesContract.getDonee(donee.address);

    expect(createdDonee.enabled).to.be.true;
  });

  it("Should not add donee with same address", async function () {
    const donee = { name: donee1Name, address: doneeAddr1.address };

    await doneesContract.addDonee(donee.name, donee.address);

    await expect(
      doneesContract.addDonee(donee.name, donee.address)
    ).to.be.revertedWith("Donee already exists");
  });

  it("Should not add donee with name longer than 32", async function () {
    const donee = { name: "a".repeat(33), address: doneeAddr1.address };

    await expect(
      doneesContract.addDonee(donee.name, donee.address)
    ).to.be.revertedWith("Name must be between 0-32 bytes");
  });

  it("Should not add donee with empty name", async function () {
    const donee = { name: "", address: doneeAddr1.address };

    await expect(
      doneesContract.addDonee(donee.name, donee.address)
    ).to.be.revertedWith("Name must be between 0-32 bytes");
  });

  it("Should not add donee with address 0", async function () {
    const donee = {
      name: donee1Name,
      address: "0x0000000000000000000000000000000000000000",
    };

    await expect(
      doneesContract.addDonee(donee.name, donee.address)
    ).to.be.revertedWith("Address cannot be 0");
  });
});
