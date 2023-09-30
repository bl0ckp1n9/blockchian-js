const Block = require("./block");
const { GENESIS_DATA, MINE_RATE } = require("../config");
const { describe, expect, test } = require("@jest/globals");
const { cryptoHash } = require("../util");
const hexToBinary = require("hex-to-binary");

describe("Block", () => {
  const timestamp = 2000; // 2 seconds
  const lastHash = "foo-hash";
  const hash = "bar-hash";
  const data = ["blockchain", "data"];
  const nonce = 1;
  const difficulty = 1;
  const block = new Block({
    timestamp,
    lastHash,
    hash,
    data,
    nonce,
    difficulty,
  });

  test("test has block property", () => {
    expect(block.timestamp).toEqual(timestamp);
    expect(block.hash).toEqual(hash);
    expect(block.lastHash).toEqual(lastHash);
    expect(block.data).toEqual(data);
    expect(block.nonce).toEqual(nonce);
    expect(block.difficulty).toEqual(difficulty);
  });

  describe("genesis()", () => {
    const genesisBlock = Block.genesis();

    test("returns a Block instance", () => {
      expect(genesisBlock instanceof Block).toBe(true);
    });

    test("returns the genesis data", () => {
      expect(genesisBlock).toEqual(GENESIS_DATA);
    });
  });

  describe("mineBlock()", () => {
    const lastBlock = Block.genesis();

    const data = "mined block";
    const minedBlock = Block.mineBlock({ lastBlock, data });

    test("returns a Block instance", () => {
      expect(minedBlock instanceof Block).toBe(true);
    });

    test("`lasthash` property of minedBlock to be equal hash of the lastBlock ", () => {
      expect(minedBlock.lastHash).toEqual(lastBlock.hash);
    });

    test("`data` property of minedBlock to be equal data passed in", () => {
      expect(minedBlock.data).toEqual(data);
    });

    test("sets timestamp", () => {
      expect(minedBlock.timestamp).not.toEqual(undefined);
    });

    test("creates a SHA-256 `hash` based on the proper inputs", () => {
      expect(minedBlock.hash).toEqual(
        cryptoHash(
          minedBlock.timestamp,
          minedBlock.nonce,
          minedBlock.difficulty,
          lastBlock.hash,
          data,
        ),
      );
    });

    test("sets a `hash` that matches the difficulty criteria", () => {
      expect(
        hexToBinary(minedBlock.hash).substring(0, minedBlock.difficulty),
      ).toEqual("0".repeat(minedBlock.difficulty));
    });

    test("adjusts the difficulty", () => {
      const possibleResults = [
        lastBlock.difficulty + 1,
        lastBlock.difficulty - 1,
      ];
      expect(possibleResults.includes(minedBlock.difficulty)).toBe(true);
    });
  });

  describe("adjustDifficulty()", () => {
    test("raises the difficulty for a quickly mined block", () => {
      expect(
        Block.adjustDifficulty({
          originalBlock: block,
          timestamp: block.timestamp + MINE_RATE - 100,
        }),
      ).toEqual(block.difficulty + 1);
    });

    test("lowers the difficulty for a slowly mined block", () => {
      expect(
        Block.adjustDifficulty({
          originalBlock: block,
          timestamp: block.timestamp + MINE_RATE + 100,
        }),
      ).toEqual(block.difficulty - 1);
    });

    test("has a lower limit of 1", () => {
      block.difficulty = -1;

      expect(Block.adjustDifficulty({ originalBlock: block })).toEqual(1);
    });
  });
});
