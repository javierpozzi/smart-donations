# Smart Donations

Smart Donations is an Ethereum smart contract for investing your donations, written in Solidity.

# Table of Contents

- [Description](#description)
- [Contracts](#contracts)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Interfaces](#interfaces)
- [Gas Report](#gas-report)
- [Credits](#credits)
- [License](#license)

# Description

Smart Donations is a blockchain solution to invest your donations. Instead of directly donating to a charity, this contract allows you to invest your tokens and donate your interests generated through time. This gives charities a periodic income that lets them plan their activities with anticipation. And in the long term, the interests from your donations will surpass the original invested amount.

The basic idea is that you transfer your tokens to the contract, so that they are added to an investment pool. The investment pool will mint the equivalent token (cToken) in the **Compound Protocol**. Each cToken is assigned an interest rate and risk model, allowing you to generate interests just by holding cTokens. Compound is an algorithmic, autonomous interest rate protocol on blockchain for supplying or borrowing assets. [More info here](https://compound.finance/)

You can check your interests generated and donate them whenever you want. Keep in mind that the amount you invest can't be donated or withdrawn, as it acts as the base of your interests generated. You can always invest more tokens to the investment pool, to increase the revenue. The contract keeps track of your total investment tokens and your interests of each token.

When you donate, you select the donees from a curated list of trusted charities. This list is mantained by the owner of the contract, but it could be upgraded with a governance token to allow the donors to manage the list of donees.

# Contracts

![Contracts Diagram](/assets/contracts-diagram.jpg)

## SmartDonation

Entry point to the contracts, acting as controller. It allows donors to invest ERC20 tokens and donate the interests generated by each of them to the trusted donees. This contract needs to be approved by the ERC20 contract with the desired amount before investing. Accounts can also check their interests generated, the total amount invested, the available tokens to invest and the trusted donees list.

## TrustedDoneesManager

Manager of the trusted donees. Currently executed by an owner, who can add, enable and disable donees. In the future, it could be upgraded to a DAO with a governance token to manage donees.

## InvestmentPool

This contract manages the donor's investments. It keeps track of the cToken balance of each donor for every token that they invest. **InvestmentPool** connects with cToken contracts of the Compound Protocol to invest, and creates an abstraction of this integration. This avoid external users to convert cToken to token just to know their real underlying balance or how much of the balance is interests generated vs original investment. **InvestmentPool** keeps track of every conversion to ensure that external users only see the underlying token (DAI, USDC...).

## Compound Token

Compound Tokens (cToken) are self-contained borrowing and lending contracts. Each cToken is assigned an interest rate and risk model, and allows accounts to _mint_ (supply capital), _redeem_ (withdraw capital), _borrow_ and _repay a borrow_. Each cToken is an ERC20 compliant token where balances represent ownership of the market.

## Other contracts

- **OpenZeppelin Ownable**: Contract module which provides a basic access control mechanism, where there is an account (an owner) that can be granted exclusive access to specific functions.
- **OpenZeppelin SafeERC20**: Wrappers around ERC20 operations that throw on failure. Used for non conventional tokens like USDT.

# Prerequisites

- [Download & Install Node.js](https://nodejs.org/en/download/) and the npm package manager. If you encounter any problems, you can also use this [GitHub Gist](https://gist.github.com/isaacs/579814) to install Node.js.
- Create an [Alchemy](https://www.alchemy.com/) account to connect to an archive node. This is used on Hardhat Network to fork mainnet and use Compound Protocol's smart contracts. Optionally, you can also use any other provider of Ethereum archive node.

# Getting started

To run the project, pull the repository and install its dependencies.

```bash
git clone https://github.com/javierpozzi/smart-donations.git
cd smart-donations
npm install
```

Rename file `.env.example` to `.env` on the root of the project.

Get your Alchemy key (or other provider Ethereum mainnet url) and paste it on `FORKING_URL` variable inside `.env` file:

```bash
FORKING_URL=https://eth-mainnet.alchemyapi.io/v2/<YOUR ALCHEMY KEY>
```

You can run the tests to verify that the installation was successful:

```bash
npm test
```

Depending of your archive node provider, some tests may timeout or take a long time the first time you run them. That's because the request to the provider doesn't complete on time. If that happens to you, just run the command again. Every time data is fetched from mainnet, Hardhat Network caches it on disk to speed up future access.

# Usage

You can directly simulate a predefined scenario with:

```bash
npm run simulation
```

This will create an indepent instance of Hardhat Network, deploy the contracts and run the tasks to simulate an scenario where an address is seeded with tokens, invest them and then donate the interests to donees.

Alternatively, you can make your own simulations with a local network. To spin up an in-memory instance of the Hardhat Network, run:

```bash
npx hardhat node
```

On another console, deploy the contracts to the network:

```bash
npm run deploy-local
```

After this, you will have an HTTP and WebSocket JSON-RPC server at `http://127.0.0.1:8545/` with the deployed contracts and a list of available accounts to use. You can run [Tasks](#tasks) to the local server to simulate different scenarios.

## Tasks

Seed an address with 100000 of each token (DAI, USDC or USDT):

```bash
npx hardhat seedAddress --address YOUR_ADDRESS --network localhost
```

Invest a token:

```bash
npx hardhat invest --contract SMART_DONATION_ADDRESS --address YOUR_ADDRESS --token YOUR_TOKEN --amountnodecimals YOUR_AMOUNT --network localhost
```

Notes:

- _Available tokens: DAI, USDC and USDT._

- _Your SmartDonation address can be found on the logs when you deployed the contract._

- _`amountnodecimals` parameter doesn't consider token's decimals. So if you want to invest 1000 DAI for example, you don't need to add 18 extra zeros for the decimals._

Check your invested amounts:

```bash
npx hardhat investedamount --contract SMART_DONATION_ADDRESS --address YOUR_ADDRESS --network localhost
```

Check your interests generated:

```bash
npx hardhat interests --contract SMART_DONATION_ADDRESS --address YOUR_ADDRESS --network localhost
```

Donate interests generated to predefined donees:

```bash
npx hardhat donate --contract SMART_DONATION_ADDRESS --address YOUR_ADDRESS --network localhost
```

# Interfaces

## SmartDonation

The **SmartDonation** contract acts as the controller and should be the only entry point as a donor. The following functions are available to interact with the contract:

### Transactions

```javascript
// Before investing a token, you should approve SmartDonation contract from the token's contract.
function investToken(bytes32 symbol, uint256 amount) external;

// The sum of the percentage of all donatedDonees should be 100.
function donateTokensGeneratedInterests(DonatedDoneeDTO[] donatedDoneeDTOs) external;

struct DonatedDoneeDTO {
    address doneeAddress;
    uint8 percentage;
}
```

### View Functions

```javascript
function getTokenGeneratedInterests(bytes32 symbol) external view returns (uint256);

function getTokenInvestedAmount(bytes32 symbol) external view returns (uint256);

function getInvertibleTokens() external view returns (bytes32[] memory);

function getTrustedDonees() external view returns (address[] memory);
```

## TrustedDoneesManager

The **TrustedDoneesManager** is managed by an owner account. The following functions are available to interact with the contract:

### Transactions

```javascript
function addDonee(bytes32 name, address addr) external;

function disableDonee(address _addr) external;

function enableDonee(address _addr) external;
```

### View Functions

```javascript
function isDoneeEnabled(address _addr) external view returns (bool);

function getDonees() external view returns (address[] memory);
```

# Gas Report

If you want to check gas usage run:

```bash
npm run gas-report
```

# Credits

This software uses the following open source projects:

- [Solidity](https://github.com/ethereum/solidity/)
- [Node.js](https://nodejs.org/)
- [Hardhat](https://hardhat.org/)
- [OpenZeppelin Contracts](https://openzeppelin.com/contracts/)
- [ethers.js](https://github.com/ethers-io/ethers.js/)
- [Compound Protocol](https://compound.finance/)

# License

[MIT](https://choosealicense.com/licenses/mit/)
