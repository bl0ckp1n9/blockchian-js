const SHA256 = require("crypto-js/sha256");
function cryptoHash(...inputs) {
  return SHA256(
    inputs
      .map((input) => {
        return typeof input === "string" ? input : JSON.stringify(input);
      })
      .sort()
      .join(" "),
  ).toString();
}

module.exports = cryptoHash;
