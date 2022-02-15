// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Trusted Donees Manager
 *
 * @dev This contract is used to manage the trusted donees.
 *
 * The trusted donees are the ones that are allowed to receive the
 * generated interests from donors. They are managed by the owner of the
 * contract.
 */
contract TrustedDoneesManager is Ownable {
    event AddDonee(bytes32 doneeName, address doneeAddress);
    event DisableDonee(bytes32 doneeName, address doneeAddress);
    event EnableDonee(bytes32 doneeName, address doneeAddress);

    struct Donee {
        bytes32 name;
        bool enabled;
    }

    mapping(address => Donee) public donees;
    address[] public doneeAddresses;

    /**
     * @dev Add a new donee to the list of trusted donees.
     *
     * @param _name The name of the donee.
     * @param _addr The address of the donee.
     */
    function addDonee(bytes32 _name, address _addr) external onlyOwner {
        require(_addr != address(0), "Address cannot be 0");
        require(donees[_addr].name == "", "Donee already exists");
        require(_name != "", "Name cannot be empty");
        donees[_addr] = Donee(_name, true);
        doneeAddresses.push(_addr);
        emit AddDonee(_name, _addr);
    }

    /**
     * @dev Disable a donee from receiving donations.
     *
     * @param _addr The address of the donee.
     */
    function disableDonee(address _addr) external onlyOwner {
        Donee storage donee = donees[_addr];
        require(donee.name != 0, "Donee does not exist");
        donee.enabled = false;
        emit DisableDonee(donee.name, _addr);
    }

    /**
     * @dev Enable a donee to receive donations.
     *
     * @param _addr The address of the donee.
     */
    function enableDonee(address _addr) external onlyOwner {
        Donee storage donee = donees[_addr];
        require(donee.name != 0, "Donee does not exist");
        donee.enabled = true;
        emit EnableDonee(donee.name, _addr);
    }

    /**
     * @dev Return if a donee is enabled to receive donations.
     */
    function isDoneeEnabled(address _addr) external view returns (bool) {
        return donees[_addr].enabled;
    }

    /**
     * @dev Return the addresses of all the donees.
     */
    function getDonees() external view returns (address[] memory) {
        return doneeAddresses;
    }
}
