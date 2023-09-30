const Transaction = require("./transaction");
const Wallet = require("./index");
const { describe, expect, beforeEach, test } = require("@jest/globals");
const { verifySignature } = require("../util");
const { REWARD_INPUT, MINING_REWARD } = require("../config");

describe("Transaction", () => {
  let transaction, senderWallet, recipient, amount;

  beforeEach(() => {
    senderWallet = new Wallet();
    recipient = "recipient-public-key";
    amount = 50;
    transaction = new Transaction({ senderWallet, recipient, amount });
  });

  test("has an `id`", () => {
    expect(transaction).toHaveProperty("id");
  });

  describe("outputMap", () => {
    test("has an `outputMap`", () => {
      expect(transaction).toHaveProperty("outputMap");
    });

    test("outputs the amount to the recipient", () => {
      expect(transaction.outputMap[recipient]).toEqual(amount);
    });

    test("outputs the remaining balance for the `senderWallet`", () => {
      expect(transaction.outputMap[senderWallet.publicKey]).toEqual(
        senderWallet.balance - amount,
      );
    });
  });

  describe("input", () => {
    test("has an `input`", () => {
      expect(transaction).toHaveProperty("input");
    });

    test("has a `timestamp` in the input", () => {
      expect(transaction.input).toHaveProperty("timestamp");
    });

    test("sets the `amount` to the `senderWallet` balance", () => {
      expect(transaction.input.amount).toEqual(senderWallet.balance);
    });

    test("sets the `address` to the `senderWallet` publicKey", () => {
      expect(transaction.input.address).toEqual(senderWallet.publicKey);
    });

    test("signs the input", () => {
      expect(
        verifySignature({
          publicKey: senderWallet.publicKey,
          data: transaction.outputMap,
          signature: transaction.input.signature,
        }),
      ).toBe(true);
    });
  });

  describe("validTransaction()", () => {
    let errorMock;

    beforeEach(() => {
      errorMock = jest.fn();
      global.console.error = errorMock;
    });

    describe("when the transaction is valid", () => {
      test("return true", () => {
        expect(Transaction.validTransaction(transaction)).toBe(true);
      });
    });

    describe("when the transaction is invalid", () => {
      describe("and a transaction outputMap value is invalid", () => {
        test("return false and logs an error", () => {
          transaction.outputMap[senderWallet.publicKey] = 999999;

          expect(Transaction.validTransaction(transaction)).toBe(false);
          expect(errorMock).toHaveBeenCalled();
        });
      });

      describe("and the transaction input signature is invalid", () => {
        test("return false and logs an error", () => {
          transaction.input.signature = new Wallet().sign("fake data");

          expect(Transaction.validTransaction(transaction)).toBe(false);
          expect(errorMock).toHaveBeenCalled();
        });
      });
    });
  });

  describe("update()", () => {
    let originalSignature, originalSenderOutput, nextRecipient, nextAmount;

    describe("and the amount is invalid", () => {
      test("throws an error", () => {
        expect(() => {
          transaction.update({
            senderWallet,
            recipient: "foo-recipient",
            amount: 999999,
          });
        }).toThrow("Amount exceeds balance");
      });
    });

    describe("and the amount is valid", () => {
      beforeEach(() => {
        originalSignature = transaction.input.signature;
        originalSenderOutput = transaction.outputMap[senderWallet.publicKey];
        nextRecipient = "next-recipient";
        nextAmount = 50;

        transaction.update({
          senderWallet,
          recipient: nextRecipient,
          amount: nextAmount,
        });
      });

      test("outputs the amount to the next recipient", () => {
        expect(transaction.outputMap[nextRecipient]).toEqual(nextAmount);
      });

      test("subtracts the amount from the sender output amount", () => {
        expect(transaction.outputMap[senderWallet.publicKey]).toEqual(
          originalSenderOutput - nextAmount,
        );
      });

      test("maintains a total output that matches the input amount", () => {
        expect(
          Object.values(transaction.outputMap).reduce(
            (total, outputAmount) => total + outputAmount,
          ),
        ).toEqual(transaction.input.amount);
      });

      test("re-sign the transaction", () => {
        expect(transaction.input.signature).not.toEqual(originalSignature);
      });
    });

    describe("and another update for the same recipient", () => {
      let addedAmount;
      let nextRecipient = "same-recipient";
      beforeEach(() => {
        addedAmount = 80;
        transaction.update({
          senderWallet,
          recipient: nextRecipient,
          amount: addedAmount,
        });

        transaction.update({
          senderWallet,
          recipient: nextRecipient,
          amount: addedAmount,
        });
      });

      test("adds to the recipient amount", () => {
        expect(transaction.outputMap[nextRecipient]).toEqual(addedAmount * 2);
      });

      test("subtracts the amount from the original sender output amount", () => {
        expect(transaction.outputMap[senderWallet.publicKey]).toEqual(
          originalSenderOutput - addedAmount * 2,
        );
      });
    });
  });

  describe("rewardTransaction()", () => {
    let rewardTransaction, minerWallet;

    beforeEach(() => {
      minerWallet = new Wallet();
      rewardTransaction = Transaction.rewardTransaction({ minerWallet });
    });

    test("creates a transaction with the reward input", () => {
      expect(rewardTransaction.input).toEqual(REWARD_INPUT);
    });

    test("creates a transaction for the miner with the `MINING_REWARD`", () => {
      expect(rewardTransaction.outputMap[minerWallet.publicKey]).toEqual(
        MINING_REWARD,
      );
    });
  });
});
