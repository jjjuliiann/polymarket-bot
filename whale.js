const WebSocket = require("ws");

const ws = new WebSocket(
  "wss://ws-subscriptions-clob.polymarket.com/ws/market"
);

ws.on("open", () => {

  console.log(
    "🔥 Connected to Polymarket"
  );

  ws.send(JSON.stringify({

    assets_ids: [
      "71321052786494864051187416442891990587016087880666014640478409226413588010462"
    ],

    type: "market"
  }));
});

ws.on("message", data => {

  try {

    const msg =
      JSON.parse(data);

    console.log(msg);

  } catch (err) {

    console.log(err);
  }
});
