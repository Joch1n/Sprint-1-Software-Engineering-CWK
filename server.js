// server.js
const app = require("./services/app"); // Import your app.js
const port = 3001;            // Choose the port you want your server to run on

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});