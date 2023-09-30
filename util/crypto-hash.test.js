const { describe, expect, test } = require("@jest/globals");
const cryptoHash = require("./crypto-hash");

describe("cryptoHash()", () => {
  test("generates a SHA-256 hashed output", () => {
    expect(cryptoHash("foo")).toEqual(
      "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae".toLowerCase(),
    );
  });

  test("produces the same hash with the same input arguments in any order", () => {
    expect(cryptoHash("one", "two", "three")).toEqual(
      cryptoHash("three", "one", "two"),
    );
  });

  test("produces a unique hash when the properties have changed on an input", () => {
    const foo = {};
    const originalHash = cryptoHash(foo);
    foo["temp"] = "temp";

    expect(originalHash).not.toEqual(cryptoHash(foo));
  });
});
