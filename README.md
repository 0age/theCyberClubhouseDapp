# theCyberClubhouseDapp

A proof of concept for a dapp that grants admission to a clubhouse (or any event or area). The prospective attendee requests a ticket, which the dapp will only approve once it detects a `GrantAdmission` contract event with a passphrase string equal to the passphrase associated with the ticket. The clubhouse only allows transactions originating from theCyber to trigger said event. Note that the clubhouse dapp subscribes to contract events but does not actually sign or broadcast any transactions.

To run a development version, set up the contracts using the [testRPC branch of theCyber](https://github.com/0age/theCyberDapp/tree/testRPC), then spin up the dapp to attach to theCyberClubhouse contract (ensure that both dapps are using same `config.json` file).

To run a development version of the frontend (replace the `REACT_APP_WEB3_PROVIDER` value with the desired endpoint):

```
$ PORT=3001 REACT_APP_WEB3_PROVIDER="ws://localhost:8845" yarn start
```

To build the production frontend (compiles to `build` folder), set the `homepage` field in `package.json` followed by:

```
$ yarn run build
```

Feel free to collaborate!
