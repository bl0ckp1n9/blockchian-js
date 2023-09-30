const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const Blockchain = require("./blockchain");
const PubSub = require("./app/pubsub");
const TransactionPool = require("./wallet/transaction-pool");
const Wallet = require("./wallet");
const TransactionMiner = require("./app/transaction-miner");

const DEFAULT_PORT = 4000;
let PEER_PORT;

if (process.env.GENERATE_PEER_PORT === "true") {
  PEER_PORT = DEFAULT_PORT + Math.ceil(Math.random() * 100);
}
const PORT = PEER_PORT || DEFAULT_PORT;

const app = express();
const blockchain = new Blockchain();
const transactionPool = new TransactionPool();
const wallet = new Wallet();
const pubsub = new PubSub({ blockchain, transactionPool });
const transactionMiner = new TransactionMiner({
  blockchain,
  transactionPool,
  wallet,
  pubsub,
});

const ROOT_NODE_ADDRESS = `http://localhost:${DEFAULT_PORT}`;

app.use(bodyParser.json());

app.get("/api/blocks", (req, res) => {
  res.json(blockchain.chain);
});

app.get("/api/transaction-pool-map", (req, res) => {
  res.json(transactionPool.transactionMap);
});

app.get("/api/mine-transactions", async (req, res) => {
  await transactionMiner.mineTransactions();

  res.redirect("/api/blocks");
});

app.get("/api/wallet-info", (req, res) => {
  const address = wallet.publicKey;

  res.json({
    address: address,
    balance: Wallet.calculateBalance({
      chain: blockchain.chain,
      address: address,
    }),
  });
});

app.post("/api/mine", async (req, res) => {
  const { data } = req.body;
  blockchain.addBlock({ data });

  await pubsub.broadcastChain();

  res.redirect("/api/blocks");
});

app.post("/api/transact", async (req, res) => {
  const { amount, recipient } = req.body;

  let transaction = transactionPool.existingTransaction({
    inputAddress: wallet.publicKey,
  });

  try {
    if (transaction) {
      transaction.update({ senderWallet: wallet, recipient, amount });
    } else {
      transaction = wallet.createTransaction({
        recipient,
        amount,
        chain: blockchain.chain,
      });
    }
  } catch (error) {
    return res.status(400).json({
      type: "error",
      message: error.message,
    });
  }

  transactionPool.setTransaction(transaction);

  await pubsub.broadcastTransaction(transaction);

  res.json({ type: "success", transaction });
});

const syncWithRootState = async () => {
  const { data: rootChain } = await axios.get(
    `${ROOT_NODE_ADDRESS}/api/blocks`,
  );
  console.log("replace chain on a sync with", rootChain);
  blockchain.replaceChain(rootChain);

  const { data: rootTransactionPoolMap } = await axios.get(
    `${ROOT_NODE_ADDRESS}/api/transaction-pool-map`,
  );
  console.log(
    "replace transaction pool map on a sync with",
    rootTransactionPoolMap,
  );
  transactionPool.setMap(rootTransactionPoolMap);
};

app.listen(PORT, async () => {
  console.log(`Listening on localhost:${PORT}`);

  if (PORT !== DEFAULT_PORT) {
    await syncWithRootState();
  }
});
