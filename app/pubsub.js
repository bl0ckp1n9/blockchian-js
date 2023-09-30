const { createClient } = require("redis");
const { v4: uuidv4 } = require("uuid");
const CHANNELS = {
  TEST: "TEST",
  BLOCKCHAIN: "BLOCKCHAIN",
  TRANSACTION: "TRANSACTION",
};

const OWN_IDENTIFIER = uuidv4();

class Redis {
  constructor() {
    this.redis = createClient();
    this.redis.on("connect", () => {
      console.log("Redis client connected");
    });
    this.redis.on("error", (err) => {
      console.log(`Something went wrong ${err}`);
    });
  }
}

class PubSub extends Redis {
  constructor({ blockchain, transactionPool }) {
    super();
    this.blockchain = blockchain;
    this.transactionPool = transactionPool;
    this.subscriber = this.redis.duplicate();
    this.publisher = this.redis.duplicate();

    this.subscriber.connect();
    this.publisher.connect();
    this.subscribeToChannels();
  }

  subscribeToChannels() {
    Object.values(CHANNELS).forEach((channel) => {
      this.subscriber.subscribe(channel, (message) =>
        this.handleMessage(channel, message),
      );
    });
  }

  async publish({ channel, message }) {
    await this.publisher.publish(
      channel,
      JSON.stringify({
        id: OWN_IDENTIFIER,
        message,
      }),
    );
  }

  async broadcastChain() {
    await this.publish({
      channel: CHANNELS.BLOCKCHAIN,
      message: this.blockchain.chain,
    });
  }

  async broadcastTransaction(transaction) {
    await this.publish({
      channel: CHANNELS.TRANSACTION,
      message: transaction,
    });
  }

  handleMessage(channel, message) {
    const parsedMessage = JSON.parse(message);
    if (parsedMessage.id === OWN_IDENTIFIER) return;

    console.log(`Message received. Channel: ${channel}. Message: ${message}`);

    switch (channel) {
      case CHANNELS.BLOCKCHAIN:
        this.blockchain.replaceChain(parsedMessage.message, true, () => {
          this.transactionPool.clearBlockchainTransactions({
            chain: parsedMessage.message,
          });
        });
        break;
      case CHANNELS.TRANSACTION:
        this.transactionPool.setTransaction(parsedMessage.message);
        break;
      default:
        return;
    }
  }
}

module.exports = PubSub;
