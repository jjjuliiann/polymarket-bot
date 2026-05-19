const express = require("express");
const fs = require("fs");

const app = express();

const PORT = 3000;

app.use(
  express.static("public")
);

app.get(
  "/api/scanner",

  (req, res) => {

    try {

      if (
        !fs.existsSync(
          "scanner.json"
        )
      ) {

        return res.json([]);
      }

      const data =
        JSON.parse(

          fs.readFileSync(
            "scanner.json",
            "utf-8"
          )
        );

      res.json(data);

    } catch {

      res.json([]);
    }
  }
);

app.listen(
  PORT,

  () => {

    console.log(
      `Dashboard running:
http://localhost:${PORT}`
    );
  }
);