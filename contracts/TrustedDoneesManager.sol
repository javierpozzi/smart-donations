// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

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

    function addDonee(bytes32 _name, address _addr) external onlyOwner {
        require(_addr != address(0), "Address cannot be 0");
        require(donees[_addr].name == "", "Donee already exists");
        require(_name != "", "Name cannot be empty");
        donees[_addr] = Donee(_name, true);
        doneeAddresses.push(_addr);
        emit AddDonee(_name, _addr);
    }

    function disableDonee(address _addr) external onlyOwner {
        Donee storage donee = donees[_addr];
        require(donee.name != 0, "Donee does not exist");
        donee.enabled = false;
        emit DisableDonee(donee.name, _addr);
    }

    function enableDonee(address _addr) external onlyOwner {
        Donee storage donee = donees[_addr];
        require(donee.name != 0, "Donee does not exist");
        donee.enabled = true;
        emit EnableDonee(donee.name, _addr);
    }

    function isDoneeEnabled(address _addr) external view returns (bool) {
        return donees[_addr].enabled;
    }
}
