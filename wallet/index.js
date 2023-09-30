const { STARTING_BALANCE } = require("../config");
const { ec, cryptoHash } = require("../util");
const Transaction = require("./transaction");
class Wallet {
  constructor() {
    this.balance = STARTING_BALANCE;
    this.key = ec.genKeyPair();
    this.publicKey = this.key.getPublic().encode("hex");
  }

  sign(data) {
    return this.key.sign(cryptoHash(data));
  }

  createTransaction({ amount, recipient, chain }) {
    if (chain) {
      this.balance = Wallet.calculateBalance({
        chain,
        address: this.publicKey,
      });
    }

    if (amount > this.balance) {
      throw new Error("Amount exceeds balance");
    }

    return new Transaction({
      senderWallet: this,
      recipient,
      amount,
    });
  }

  static calculateBalance({ chain, address }) {
    let hasConductedTransaction = false;
    let total = 0;
    for (let i = chain.length - 1; i > 0; i--) {
      const block = chain[i];

      for (let transaction of block.data) {
        if (transaction.input.address === address) {
          hasConductedTransaction = true;
        }

        if (transaction.outputMap[address]) {
          total += transaction.outputMap[address];
        }
      }

      if (hasConductedTransaction) {
        break;
      }
    }

    return hasConductedTransaction ? total : STARTING_BALANCE + total;
  }
}

module.exports = Wallet;
