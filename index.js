require("dotenv").config();

const fs = require("fs");
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// =====================
// SETTINGS
// =====================

const LOOP_INTERVAL = 60000;

// =====================
// TARGET KEYWORDS
// =====================

const TARGET_MARKETS = [

  "bitcoin",

  "btc",

  "ethereum",

  "eth",

  "solana",

  "sol"
];

// =====================
// PAPER POSITIONS
// =====================

let paperPositions = {};

if (
  fs.existsSync(
    "positions.json"
  )
) {

  paperPositions =
    JSON.parse(

      fs.readFileSync(
        "positions.json",
        "utf-8"
      )
    );
}

// =====================
// AI COMMENTARY
// =====================

async function getAICommentary(data) {

  try {

    const prompt = `
You are an elite crypto prediction market analyst.

Analyze briefly.

Market:
${data.question}

Entry:
${data.entry}

Current:
${data.price}

PnL:
${data.pnl}

Signal:
${data.signal}
`;

    const msg =
      await anthropic.messages.create({

        model:
          "claude-sonnet-4-6",

        max_tokens: 80,

        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

    return msg.content[0].text;

  } catch {

    return "Claude unavailable.";
  }
}

// =====================
// ANALYZE MARKET
// =====================

async function analyzeMarket(market) {

  try {

    const clobTokenIds =
      JSON.parse(
        market.clobTokenIds
      );

    const tokenId =
      clobTokenIds[0];

    const orderRes =
      await fetch(
        `https://clob.polymarket.com/book?token_id=${tokenId}`
      );

    const data =
      await orderRes.json();

    const price =
      parseFloat(
        data.last_trade_price ||
        market.lastTradePrice ||
        0
      );

    // =====================
    // ORDER FLOW
    // =====================

    let totalBid = 0;
    let totalAsk = 0;

    for (const b of data.bids) {

      totalBid +=
        parseFloat(b.size);
    }

    for (const a of data.asks) {

      totalAsk +=
        parseFloat(a.size);
    }

    // =====================
    // ENGINE
    // =====================

    const imbalance =
      (totalBid - totalAsk) /
      (totalBid + totalAsk + 1);

    const pressureScore =
      (imbalance + 1) * 50;

    const smartScore =
      pressureScore * 0.9;

    const liquidityScore =
      Math.min(
        totalBid + totalAsk,
        100000
      ) / 1000;

    let confidence =
      pressureScore * 0.4 +
      smartScore * 0.4 +
      liquidityScore * 0.2;

    confidence =
      Math.min(confidence, 100);

    // =====================
    // WHALES
    // =====================

    const whaleBuy =
      data.bids
        .filter(
          b =>
            parseFloat(b.size) > 5000
        )
        .reduce(
          (sum, b) =>
            sum + parseFloat(b.size),
          0
        );

    const whaleSell =
      data.asks
        .filter(
          a =>
            parseFloat(a.size) > 5000
        )
        .reduce(
          (sum, a) =>
            sum + parseFloat(a.size),
          0
        );

    const whaleTotal =
      whaleBuy +
      whaleSell +
      1;

    const whaleBuyPercent =
      (whaleBuy / whaleTotal) *
      100;

    const whaleSellPercent =
      (whaleSell / whaleTotal) *
      100;

    // =====================
    // SIGNAL
    // =====================

    let signal = "HOLD";

    if (
      confidence > 70 &&
      whaleBuyPercent > 60
    ) {

      signal = "BUY 📈";
    }

    if (
      confidence < 40 &&
      whaleSellPercent > 60
    ) {

      signal = "SELL 📉";
    }

    // =====================
    // PAPER ENTRY
    // =====================

    if (
      signal.includes("BUY")
    ) {

      if (
        !paperPositions[
          market.question
        ]
      ) {

        paperPositions[
          market.question
        ] = {

          entry:
            price
        };
      }
    }

    // =====================
    // ENTRY
    // =====================

    let entryPrice =
      price;

    if (
      paperPositions[
        market.question
      ]
    ) {

      entryPrice =
        paperPositions[
          market.question
        ].entry;
    }

    // =====================
    // PNL
    // =====================

    let pnl =
      (
        (
          price -
          entryPrice
        ) /
        entryPrice
      ) * 100;

    const result = {

      question:
        market.question,

      entry:
        entryPrice,

      price,

      confidence,

      whaleBuy:
        whaleBuyPercent,

      whaleSell:
        whaleSellPercent,

      signal,

      pnl:
        pnl.toFixed(2)
    };

    // =====================
    // AI
    // =====================

    if (
      confidence > 75
    ) {

      result.aiCommentary =
        await getAICommentary(
          result
        );

    } else {

      result.aiCommentary =
        "Confidence not high enough.";
    }

    return result;

  } catch {

    return null;
  }
}

// =====================
// MAIN
// =====================

async function main() {

  try {

    console.clear();

    console.log(
      "\n💰 CRYPTO LIQUID MARKET BOT\n"
    );

    const marketRes =
      await fetch(
        "https://gamma-api.polymarket.com/markets"
      );

    const markets =
      await marketRes.json();

    // =====================
    // FILTER
    // =====================

    const selectedMarkets =

      markets

        .filter(m =>

          m.active === true &&

          m.closed === false &&

          m.question &&

          m.volumeNum > 10000 &&

          TARGET_MARKETS.some(

            keyword =>

              m.question
                .toLowerCase()
                .includes(
                  keyword
                )
          )

          // BLACKLIST
          &&

          !m.question
            .toLowerCase()
            .includes("gta")

          &&

          !m.question
            .toLowerCase()
            .includes("before")

          &&

          !m.question
            .toLowerCase()
            .includes("jesus")

          &&

          !m.question
            .toLowerCase()
            .includes("stanley cup")

          &&

          !m.question
            .toLowerCase()
            .includes("2026")
        )

        .sort(
          (a, b) =>

            b.volumeNum -
            a.volumeNum
        )

        .slice(0, 5);

    // =====================
    // DEBUG
    // =====================

    console.log(
      "\nTRACKED MARKETS:\n"
    );

    selectedMarkets.forEach(
      m => {

        console.log(
          "-",
          m.question
        );
      }
    );

    const results = [];

    for (const market of selectedMarkets) {

      const analysis =
        await analyzeMarket(
          market
        );

      if (analysis) {

        results.push(
          analysis
        );
      }
    }

    // =====================
    // SAVE FILES
    // =====================

    fs.writeFileSync(

      "positions.json",

      JSON.stringify(
        paperPositions,
        null,
        2
      )
    );

    fs.writeFileSync(

      "scanner.json",

      JSON.stringify(
        results,
        null,
        2
      )
    );

    // =====================
    // OUTPUT
    // =====================

    console.log(
      "\n🔥 RESULTS:\n"
    );

    results.forEach(
      (r, i) => {

        console.log(

`${i + 1}. ${r.question}

ENTRY:
${r.entry}

CURRENT:
${r.price}

PnL:
${r.pnl}%

CONFIDENCE:
${r.confidence.toFixed(1)}%

WHALE BUY:
${r.whaleBuy.toFixed(1)}%

SIGNAL:
${r.signal}

AI:
${r.aiCommentary}

----------------------`
        );
      }
    );

  } catch (err) {

    console.log(
      err.message
    );
  }
}

main();

setInterval(
  main,
  LOOP_INTERVAL
);