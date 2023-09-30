const { describe, beforeEach, expect, test } = require("@jest/globals");
const Block = require("./block");
const Blockchain = require("./index");
const Wallet = require("../wallet");
const Transaction = require("../wallet/transaction");
const { cryptoHash } = require("../util");
describe("blockchain", () => {
  let blockchain, newChain, originalChain, errorMock;

  beforeEach(() => {
    blockchain = new Blockchain();
    newChain = new Blockchain();
    errorMock = jest.fn();
    global.console.error = errorMock;

    originalChain = blockchain.chain;
  });

  test("contains a `chain` Array instance", () => {
    expect(blockchain.chain instanceof Array).toBe(true);
  });

  test("starts with the genesis block", () => {
    expect(blockchain.chain[0]).toEqual(Block.genesis());
  });

  test("addBlock()", () => {
    const newData = "foo bar";

    blockchain.addBlock({ data: newData });
    expect(blockchain.chain[blockchain.chain.length - 1].data).toEqual(newData);
  });

  describe("isValidChain()", () => {
    describe("when the chain does not start with the genesis block", () => {
      test("returns false", () => {
        blockchain.chain[0] = { data: "fake-genesis" };
        expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
      });
    });

    describe("when the chain starts with the genesis block and has multiple blocks", () => {
      beforeEach(() => {
        blockchain.addBlock({ data: "Bears" });
        blockchain.addBlock({ data: "Beets" });
        blockchain.addBlock({ data: "Battlestar Galactica" });
      });

      describe("and a `lastHash` reference has changed", () => {
        test("return false", () => {
          blockchain.chain[2].lastHash = "broken-lastHash";

          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
        });
      });

      describe("and the chain contains a block with an invalid field", () => {
        test("returns false", () => {
          blockchain.chain[2].data = "some-bad-and-evil-data";

          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
        });
      });

      describe("and the chain contains a block with a jumped difficulty", () => {
        test("returns false", () => {
          const lastBlock = blockchain.chain[blockchain.chain.length - 1];
          const lastHash = lastBlock.hash;
          const timestamp = Date.now();
          const nonce = 0;
          const data = [];
          const difficulty = lastBlock.difficulty - 3;

          const hash = cryptoHash(timestamp, lastHash, difficulty, nonce, data);

          const badBlock = new Block({
            timestamp,
            lastHash,
            hash,
            nonce,
            difficulty,
            data,
          });

          blockchain.chain.push(badBlock);

          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
        });
      });

      describe("and the chain does not contain any invalid blocks", () => {
        test("returns true", () => {
          expect(Blockchain.isValidChain(blockchain.chain)).toBe(true);
        });
      });
    });

    describe("replaceChain()", () => {
      describe("when the new chain is not longer", () => {
        test("does not replace the chain", () => {
          newChain.chain[0] = { new: "chain" };

          blockchain.replaceChain(newChain.chain);

          expect(blockchain.chain).toEqual(originalChain);
        });
      });

      describe("when the new chain is longer", () => {
        beforeEach(() => {
          newChain.addBlock({ data: "Bears" });
          newChain.addBlock({ data: "Beets" });
          newChain.addBlock({ data: "Battlestar Galactica" });
        });

        describe("and the chain is invalid", () => {
          test("does not replace the chain", () => {
            newChain.chain[2].hash = "some-fake-hash";

            blockchain.replaceChain(newChain.chain);

            expect(blockchain.chain).toEqual(originalChain);
          });
        });

        describe("and the chain is valid", () => {
          test("replaces the chain", () => {
            blockchain.replaceChain(newChain.chain);

            expect(blockchain.chain).toEqual(newChain.chain);
          });
        });
      });

      describe("and the `validateTransactions` flag is true", () => {
        test("calls validTransactionData()", () => {
          const validTransactionDataMock = jest.fn();

          blockchain.validTransactionData = validTransactionDataMock;

          newChain.addBlock({ data: "foo" });
          blockchain.replaceChain(newChain.chain, true);

          expect(validTransactionDataMock).toHaveBeenCalled();
        });
      });
    });
  });

  describe("validTransactionData()", () => {
    let transaction, rewardTransaction, wallet;

    beforeEach(() => {
      wallet = new Wallet();
      transaction = wallet.createTransaction({
        recipient: "foo-address",
        amount: 65,
      });
      rewardTransaction = Transaction.rewardTransaction({
        minerWallet: wallet,
      });
    });

    describe("and the transaction data is valid", () => {
      test("returns true", () => {
        newChain.addBlock({ data: [transaction, rewardTransaction] });

        expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(
          true,
        );
        expect(errorMock).not.toHaveBeenCalled();
      });
    });

    describe("and the transaction data has multiple rewards", () => {
      test("returns false", () => {
        newChain.addBlock({
          data: [transaction, rewardTransaction, rewardTransaction],
        });
        expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(
          false,
        );
        expect(errorMock).toHaveBeenCalled();
      });
    });

    describe("and the transaction data has at least one malformed outputMap", () => {
      describe("and the transaction is not a reward transaction", () => {
        test("returns false", () => {
          transaction.outputMap[wallet.publicKey] = 999999;
          newChain.addBlock({
            data: [transaction, rewardTransaction],
          });
          expect(
            blockchain.validTransactionData({ chain: newChain.chain }),
          ).toBe(false);
          expect(errorMock).toHaveBeenCalled();
        });
      });

      describe("and the transaction is a reward transaction", () => {
        test("returns false", () => {
          transaction.outputMap[wallet.publicKey] = 999999;
          newChain.addBlock({
            data: [transaction, rewardTransaction],
          });
          expect(
            blockchain.validTransactionData({ chain: newChain.chain }),
          ).toBe(false);
          expect(errorMock).toHaveBeenCalled();
        });
      });
    });

    describe("and the transaction data has at least one malformed input", () => {
      test("returns false", () => {
        wallet.balance = 9000;

        const evilOutputMap = {
          [wallet.publicKey]: 8900,
          fooRecipient: 100,
        };

        const evilTransaction = {
          input: {
            timestamp: Date.now(),
            amount: wallet.balance,
            address: wallet.publicKey,
            signature: wallet.sign(evilOutputMap),
          },
          outputMap: evilOutputMap,
        };

        newChain.addBlock({
          data: [evilTransaction, rewardTransaction],
        });
        expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(
          false,
        );
        expect(errorMock).toHaveBeenCalled();
      });
    });

    describe("and a block contains multiple identical transactions", () => {
      test("returns false", () => {
        newChain.addBlock({
          data: [transaction, transaction, transaction, rewardTransaction],
        });
        expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(
          false,
        );
        expect(errorMock).toHaveBeenCalled();
      });
    });
  });
});
