const Block = require("./block");
const Wallet = require("../wallet");
const Transaction = require("../wallet/transaction");
const { cryptoHash } = require("../util");
const { REWARD_INPUT, MINING_REWARD } = require("../config");
class Index {
  constructor() {
    this.chain = [Block.genesis()];
  }

  static isValidChain(chain) {
    // validate genesis block
    if (JSON.stringify(chain[0]) !== JSON.stringify(Block.genesis())) {
      return false;
    }

    // validation of each block
    for (let i = 1; i < chain.length; i++) {
      const block = chain[i];
      const actualLastHash = chain[i - 1].hash;
      const { timestamp, lastHash, hash, nonce, difficulty, data } = block;
      const lastDifficulty = chain[i - 1].difficulty;

      // validate lastHash
      if (lastHash !== actualLastHash) return false;

      // validate hash, it is validate data of block
      const validatedHash = cryptoHash(
        timestamp,
        lastHash,
        data,
        nonce,
        difficulty,
      );
      if (hash !== validatedHash) return false;
      if (Math.abs(lastDifficulty - difficulty) > 1) return false;
    }

    return true;
  }

  addBlock({ data }) {
    const newBlock = Block.mineBlock({
      lastBlock: this.chain[this.chain.length - 1],
      data,
    });
    this.chain.push(newBlock);
  }

  replaceChain(newChain, validateTransactions, onSuccess) {
    // check length of new chain
    if (newChain.length <= this.chain.length) {
      console.error("The incoming chain must be longer");
      return;
    }

    // check valid chain
    if (!Index.isValidChain(newChain)) {
      console.error("The incoming chain must be valid");
      return;
    }

    if (
      validateTransactions &&
      !this.validTransactionData({ chain: newChain })
    ) {
      console.error("The incoming chain has invalid data");
      return;
    }

    if (onSuccess) onSuccess();
    this.chain = newChain;
  }

  validTransactionData({ chain }) {
    for (let i = 1; i < chain.length; i++) {
      const block = chain[i];
      const transactionSet = new Set();
      let rewardTransactionCount = 0;
      for (let transaction of block.data) {
        if (transaction.input.address === REWARD_INPUT.address) {
          rewardTransactionCount += 1;

          if (rewardTransactionCount > 1) {
            console.error("Miner rewards exceed limit");
            return false;
          }

          if (Object.values(transaction.outputMap)[0] !== MINING_REWARD) {
            console.error("Miner reward amount is invalid");
            return false;
          }
        } else {
          if (!Transaction.validTransaction(transaction)) {
            console.error("Invalid transaction");
            return false;
          }

          const trueBalance = Wallet.calculateBalance({
            chain: this.chain,
            address: transaction.input.address,
          });

          if (transaction.input.amount !== trueBalance) {
            console.error("Invalid input amount");
            return false;
          }

          if (transactionSet.has(transaction)) {
            console.error(
              "An identical transaction appears more than once in the block",
            );
            return false;
          } else {
            transactionSet.add(transaction);
          }
        }
      }
    }

    return true;
  }
}

module.exports = Index;
