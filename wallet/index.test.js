const Wallet = require("./index");
const Transaction = require("./transaction");
const Blockchain = require("../blockchain");
const { verifySignature } = require("../util/index");
const { describe, expect, beforeEach, test } = require("@jest/globals");
const { STARTING_BALANCE } = require("../config");
describe("Wallet", () => {
  let wallet;

  beforeEach(() => {
    wallet = new Wallet();
  });

  test("has a balance", () => {
    expect(wallet).toHaveProperty("balance");
  });

  test("has a publicKey", () => {
    expect(wallet).toHaveProperty("publicKey");
  });

  describe("signing data", () => {
    const data = "foobar";

    test("verifies a signature", () => {
      expect(
        verifySignature({
          publicKey: wallet.publicKey,
          data,
          signature: wallet.sign(data),
        }),
      ).toBe(true);
    });

    test("does not verify an invalid signature", () => {
      expect(
        verifySignature({
          publicKey: wallet.publicKey,
          data,
          signature: new Wallet().sign(data),
        }),
      ).toBe(false);
    });
  });

  describe("createTransaction()", () => {
    describe("and the amount exceeds the balance", () => {
      test("throws an error", () => {
        expect(() =>
          wallet.createTransaction({
            amount: 999999,
            recipient: "foo-recipient",
          }),
        ).toThrow("Amount exceeds balance");
      });
    });
    describe("and the amount is valid", () => {
      let transaction, amount, recipient;

      beforeEach(() => {
        amount = 50;
        recipient = "foo-recipient";
        transaction = wallet.createTransaction({ amount, recipient });
      });

      test("creates an instance of `Transaction`", () => {
        expect(transaction instanceof Transaction).toBe(true);
      });

      test("matches the transaction input with the wallet", () => {
        expect(transaction.input.address).toEqual(wallet.publicKey);
      });

      test("outputs the amount to the recipient", () => {
        expect(transaction.outputMap[recipient]).toEqual(amount);
      });
    });

    describe("and a chain is passed", () => {
      test("calls `Wallet.calculateBalance`", () => {
        const calculateBalanceMock = jest.fn();

        calculateBalanceMock(Wallet.calculateBalance);

        wallet.createTransaction({
          recipient: "foo",
          amount: 10,
          chain: new Blockchain().chain,
        });

        expect(calculateBalanceMock).toHaveBeenCalled();
      });
    });
  });

  describe("cacluateBalance()", () => {
    let blockchain;

    beforeEach(() => {
      blockchain = new Blockchain();
    });

    describe("and there are no outputs for the wallet", () => {
      test("returns the `STARTING_BALANCE`", () => {
        expect(
          Wallet.calculateBalance({
            chain: blockchain.chain,
            address: wallet.publicKey,
          }),
        ).toEqual(STARTING_BALANCE);
      });
    });

    describe("and there are outputs for the wallet", () => {
      let transactionOne, transactionTwo;

      beforeEach(() => {
        transactionOne = new Wallet().createTransaction({
          recipient: wallet.publicKey,
          amount: 50,
        });

        transactionTwo = new Wallet().createTransaction({
          recipient: wallet.publicKey,
          amount: 60,
        });

        blockchain.addBlock({ data: [transactionOne, transactionTwo] });
      });

      test("adds the sum of all outputs to the wallet balance", () => {
        expect(
          Wallet.calculateBalance({
            chain: blockchain.chain,
            address: wallet.publicKey,
          }),
        ).toEqual(
          STARTING_BALANCE +
            transactionOne.outputMap[wallet.publicKey] +
            transactionTwo.outputMap[wallet.publicKey],
        );
      });

      describe("and the wallet has made a transaction", () => {
        let recentTransaction;

        beforeEach(() => {
          recentTransaction = wallet.createTransaction({
            recipient: "foo-address",
            amount: 30,
          });

          blockchain.addBlock({ data: [recentTransaction] });
        });

        test("returns the output amount of the recent transaction", () => {
          expect(
            Wallet.calculateBalance({
              chain: blockchain.chain,
              address: wallet.publicKey,
            }),
          ).toEqual(recentTransaction.outputMap[wallet.publicKey]);
        });

        describe("and there are outputs next to and after the recent transaction", () => {
          let sameBlockTransaction, nextBlockTransaction;

          beforeEach(() => {
            recentTransaction = wallet.createTransaction({
              recipient: "later-foo-address",
              amount: 60,
            });

            sameBlockTransaction = Transaction.rewardTransaction({
              minerWallet: wallet,
            });

            blockchain.addBlock({
              data: [recentTransaction, sameBlockTransaction],
            });

            nextBlockTransaction = new Wallet().createTransaction({
              recipient: wallet.publicKey,
              amount: 75,
            });

            blockchain.addBlock({ data: [nextBlockTransaction] });
            console.log("chain length", blockchain.chain.length);
          });

          test("includes the output amounts in the returned balance", () => {
            expect(
              Wallet.calculateBalance({
                chain: blockchain.chain,
                address: wallet.publicKey,
              }),
            ).toEqual(
              recentTransaction.outputMap[wallet.publicKey] +
                sameBlockTransaction.outputMap[wallet.publicKey] +
                nextBlockTransaction.outputMap[wallet.publicKey],
            );
          });
        });
      });
    });
  });
});
