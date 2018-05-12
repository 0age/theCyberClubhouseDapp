# theCyberClubhouseDapp

A proof of concept for a dapp that grants admission to a clubhouse (or any event or area). The prospective attendee requests a ticket, which the dapp will only approve once it detects a `GrantAdmission` contract event with a passphrase string equal to the passphrase associated with the ticket. The clubhouse only allows transactions originating from theCyber to trigger said event. Note that the clubhouse dapp subscribes to contract events but does not actually sign or broadcast any transactions.

To run a development version of the frontend (It will use infura's websocket by default, you can include a `REACT_APP_WEB3_PROVIDER` environment variable pointing to another web3 provider that will override it):

```
$ PORT=3001 yarn start
```

To build the production frontend (compiles to `build` folder), set the `homepage` field in `package.json` followed by:

```
$ yarn run build
```

Feel free to collaborate!
