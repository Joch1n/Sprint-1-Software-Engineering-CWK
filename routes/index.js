// index.js
const express = require("express");
const path = require("path");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "secret123",
    resave: false,
    saveUninitialized: true,
  })
);

// View engine
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// MySQL connection
const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "password", // make sure this matches your MySQL password
  database: "zerowaste",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    console.error("Make sure MySQL is running on localhost and credentials are correct");
  } else {
    console.log("✅ Connected to MySQL");
  }
});

// Routes
app.get("/", (req, res) => {
  db.query("SELECT * FROM Food_Listings", (err, results) => {
    if (err) return res.status(500).send(err.message);
    res.render("index", { items: results, user: req.session.user });
  });
});

app.get("/login", (req, res) => res.render("login"));

app.get("/signup", (req, res) => res.render("signup"));

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO Users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hash],
    (err) => {
      if (err) return res.status(500).send(err.message);
      res.redirect("/login");
    }
  );
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM Users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.send("Database error");
    if (results.length === 0) return res.send("User not found");

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.send("Wrong password");

    req.session.user = user;
    res.redirect("/");
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/foodlistings", (req, res) => {
  db.query("SELECT * FROM Food_Listings", (err, results) => {
    if (err) return res.send(err.message);
    res.render("foodlistings", { listings: results, user: req.session.user });
  });
});

app.get("/item/:id", (req, res) => {
  db.query(
    "SELECT * FROM Food_Listings WHERE listing_id = ?",
    [req.params.id],
    (err, results) => {
      if (err) return res.send(err.message);
      if (!results.length) return res.send("Item not found");
      res.render("item", { item: results[0], user: req.session.user });
    }
  );
});

app.post("/items", (req, res) => {
  const {
    food_name,
    description,
    quantity,
    best_before,
    collection_location,
    collection_times,
  } = req.body;

  db.query(
    `INSERT INTO Food_Listings 
      (food_name, description, quantity, best_before, collection_location, collection_times) 
      VALUES (?, ?, ?, ?, ?, ?)`,
    [food_name, description, quantity, best_before, collection_location, collection_times],
    (err) => {
      if (err) return res.status(500).send(err.message);
      res.redirect("/foodlistings");
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});