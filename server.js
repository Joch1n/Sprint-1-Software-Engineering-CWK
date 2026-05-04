// server.js
const app = require("./app"); // Import your app.js
const port = 3000;            // Choose the port you want your server to run on

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});