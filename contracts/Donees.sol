// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract Donees is Ownable {
    event AddDonee(string doneeName, address doneeAddress);

    struct DoneeData {
        bytes32 name;
        bool enabled;
        uint256 totalDonated;
    }

    mapping(address => DoneeData) private donees;
    address[] private doneeAddresses;

    function addDonee(string memory _name, address _addr) external {
        require(_addr != address(0), "Address cannot be 0");
        require(donees[_addr].name == "", "Donee already exists");
        bytes memory nameBytes = bytes(_name);
        require(
            nameBytes.length > 0 && nameBytes.length <= 32,
            "Name must be between 0-32 bytes"
        );

        donees[_addr] = DoneeData(bytes32(nameBytes), true, 0);
        doneeAddresses.push(_addr);
        emit AddDonee(_name, _addr);
    }

    function disableDonee(address _addr) external {
        require(donees[_addr].name != "", "Donee does not exist");
        donees[_addr].enabled = false;
    }

    function enableDonee(address _addr) external {
        require(donees[_addr].name != "", "Donee does not exist");
        donees[_addr].enabled = true;
    }

    function getDonee(address _addr) external view returns (DoneeData memory) {
        return donees[_addr];
    }

    function isDoneeEnabled(address _addr) public view returns (bool) {
        return donees[_addr].enabled;
    }
}
