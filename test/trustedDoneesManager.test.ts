import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { TrustedDoneesManager } from "../typechain";

describe("Trusted Donees Manager", function () {
  let trustedDoneesManagerContract: TrustedDoneesManager;
  let accounts: SignerWithAddress[];
  let donee1: { name: string; address: string };
  let donee2: { name: string; address: string };
  let donee3: { name: string; address: string };
  let inexistentDonee: { name: string; address: string };

  const donee1NameAsBytes32 = ethers.utils.formatBytes32String("Donee 1");
  const donee2NameAsBytes32 = ethers.utils.formatBytes32String("Donee 2");
  const donee3NameAsBytes32 = ethers.utils.formatBytes32String("Donee 3");
  const inexistentDoneeNameAsBytes32 =
    ethers.utils.formatBytes32String("Not a donee");

  before(async () => {
    accounts = await ethers.getSigners();
    const [donee1Addr, donee2Addr, donee3Addr, inexistentDoneeAddr] = accounts;
    donee1 = { name: donee1NameAsBytes32, address: donee1Addr.address };
    donee2 = { name: donee2NameAsBytes32, address: donee2Addr.address };
    donee3 = { name: donee3NameAsBytes32, address: donee3Addr.address };
    inexistentDonee = {
      name: inexistentDoneeNameAsBytes32,
      address: inexistentDoneeAddr.address,
    };
  });

  beforeEach(async function () {
    const TrustedDoneesManager = await ethers.getContractFactory(
      "TrustedDoneesManager"
    );
    trustedDoneesManagerContract = await TrustedDoneesManager.deploy();
    await trustedDoneesManagerContract.deployed();
  });

  describe("Add donee", function () {
    it("Should add donee", async function () {
      await trustedDoneesManagerContract.addDonee(donee1.name, donee1.address);

      const createdDonee = await trustedDoneesManagerContract.donees(
        donee1.address
      );

      expect(createdDonee.name).to.be.equals(donee1.name);
    });

    it("Should add donee with enabled true", async function () {
      await trustedDoneesManagerContract.addDonee(donee1.name, donee1.address);

      const isDoneeEnabled = await trustedDoneesManagerContract.isDoneeEnabled(
        donee1.address
      );

      expect(isDoneeEnabled).to.be.true;
    });

    it("Should add multiple donees", async function () {
      await trustedDoneesManagerContract.addDonee(donee1.name, donee1.address);
      await trustedDoneesManagerContract.addDonee(donee2.name, donee2.address);
      await trustedDoneesManagerContract.addDonee(donee3.name, donee3.address);

      const createdDonee1 = await trustedDoneesManagerContract.donees(
        donee1.address
      );
      const createdDonee2 = await trustedDoneesManagerContract.donees(
        donee2.address
      );
      const createdDonee3 = await trustedDoneesManagerContract.donees(
        donee3.address
      );

      expect(createdDonee1.name).to.be.equals(donee1.name);
      expect(createdDonee2.name).to.be.equals(donee2.name);
      expect(createdDonee3.name).to.be.equals(donee3.name);
    });

    it("Should not add donee with address 0", async function () {
      const donee = {
        name: donee1.name,
        address: "0x0000000000000000000000000000000000000000",
      };

      await expect(
        trustedDoneesManagerContract.addDonee(donee.name, donee.address)
      ).to.be.revertedWith("Address cannot be 0");
    });

    it("Should not add donee with existing address", async function () {
      await trustedDoneesManagerContract.addDonee(donee1.name, donee1.address);

      await expect(
        trustedDoneesManagerContract.addDonee(donee1.name, donee1.address)
      ).to.be.revertedWith("Donee already exists");
    });

    it("Should not add donee with empty name", async function () {
      const donee = {
        name: ethers.utils.formatBytes32String(""),
        address: donee1.address,
      };

      await expect(
        trustedDoneesManagerContract.addDonee(donee.name, donee.address)
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Should emit AddDonee event when adding a donee", async function () {
      await expect(
        trustedDoneesManagerContract.addDonee(donee1.name, donee1.address)
      )
        .to.emit(trustedDoneesManagerContract, "AddDonee")
        .withArgs(donee1.name, donee1.address);
    });
  });

  describe("Disable donee", function () {
    beforeEach(async function () {
      await trustedDoneesManagerContract.addDonee(donee1.name, donee1.address);
    });

    it("Should disabled donee", async function () {
      await trustedDoneesManagerContract.disableDonee(donee1.address);

      const isDoneeEnabled = await trustedDoneesManagerContract.isDoneeEnabled(
        donee1.address
      );

      expect(isDoneeEnabled).to.be.false;
    });

    it("Should not disable inexistent donee", async function () {
      await expect(
        trustedDoneesManagerContract.disableDonee(inexistentDonee.address)
      ).to.be.revertedWith("Donee does not exist");
    });

    it("Should not disable other donees", async function () {
      await trustedDoneesManagerContract.addDonee(donee2.name, donee2.address);

      const isDonee2EnabledBeforeTransaction =
        await trustedDoneesManagerContract.isDoneeEnabled(donee2.address);

      await trustedDoneesManagerContract.disableDonee(donee1.address);

      const isDonee2EnabledAfterTransaction =
        await trustedDoneesManagerContract.isDoneeEnabled(donee2.address);

      expect(isDonee2EnabledBeforeTransaction).to.be.equals(
        isDonee2EnabledAfterTransaction
      );
    });

    it("Should emit DisableDonee event when disabling a donee", async function () {
      await expect(trustedDoneesManagerContract.disableDonee(donee1.address))
        .to.emit(trustedDoneesManagerContract, "DisableDonee")
        .withArgs(donee1.name, donee1.address);
    });
  });

  describe("Enable donee", function () {
    beforeEach(async function () {
      await trustedDoneesManagerContract.addDonee(donee1.name, donee1.address);
    });

    it("Should enable donee", async function () {
      await trustedDoneesManagerContract.disableDonee(donee1.address);

      await trustedDoneesManagerContract.enableDonee(donee1.address);

      const isDoneeEnabled = await trustedDoneesManagerContract.isDoneeEnabled(
        donee1.address
      );

      expect(isDoneeEnabled).to.be.true;
    });

    it("Should not enable inexistent donee", async function () {
      await expect(
        trustedDoneesManagerContract.enableDonee(inexistentDonee.address)
      ).to.be.revertedWith("Donee does not exist");
    });

    it("Should not enable other donees", async function () {
      await trustedDoneesManagerContract.addDonee(donee2.name, donee2.address);

      await trustedDoneesManagerContract.disableDonee(donee2.address);

      const isDonee2EnabledBeforeTransaction =
        await trustedDoneesManagerContract.isDoneeEnabled(donee2.address);

      await trustedDoneesManagerContract.enableDonee(donee1.address);

      const isDonee2EnabledAfterTransaction =
        await trustedDoneesManagerContract.isDoneeEnabled(donee2.address);

      expect(isDonee2EnabledBeforeTransaction).to.be.equals(
        isDonee2EnabledAfterTransaction
      );
    });

    it("Should emit EnableDonee event when enabling a donee", async function () {
      await expect(trustedDoneesManagerContract.enableDonee(donee1.address))
        .to.emit(trustedDoneesManagerContract, "EnableDonee")
        .withArgs(donee1.name, donee1.address);
    });
  });
});
