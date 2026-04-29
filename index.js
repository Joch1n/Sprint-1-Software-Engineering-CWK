"use strict";

console.log("Entrypoint started");

const app = require("./app/app.js");

const port = 3000;
app.listen(port, () => {
  console.log(`App running at http://localhost:${port}`);
});