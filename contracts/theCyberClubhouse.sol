pragma solidity ^0.4.19;

contract theCyberClubhouse {
  // this is an example contract that will inform a dapp whether or not to
  // provide admission to some area based on membership in theCyber, or at least
  // requiring a member of theCyber to vouch for you. The potential attendee
  // is given a passphrase or other code, and is only admitted after the dapp
  // detects a GrantAdmission event that matches the provided passphrase.

  event GrantAdmission(string passphrase);

  address private constant THECYBERADDRESS = 0x97A99C819544AD0617F48379840941eFbe1bfAE1;

  modifier membersOnly() {
    // Only allow transactions originating from theCyber contract.
    require(msg.sender == THECYBERADDRESS);
    _;
  }

  function theCyberMessage(string passphrase) public membersOnly {
    GrantAdmission(passphrase);
  }
}