"use strict";

const express = require("express");
const app = express();
const db = require("./services/db");
const bcrypt = require("bcrypt");
const multer = require("multer");
const session = require("express-session");

// Middleware
app.use(express.static("static"));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "secret123",
  resave: false,
  saveUninitialized: true
}));

// View engine
app.set("view engine", "pug");
app.set("views", __dirname + "/views");

// File upload config
const storage = multer.diskStorage({
  destination: "static/uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// ======================
// AUTH ROUTES
// ======================

// Login page
app.get("/login", (req, res) => {
  res.render("login");
});

// Register page
app.get("/register", (req, res) => {
  res.render("register");
});

// Register
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hash]
  );

  res.redirect("/login");
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const users = await db.query("SELECT * FROM users WHERE email = ?", [email]);

  if (users.length === 0) return res.send("User not found");

  const user = users[0];
  const match = await bcrypt.compare(password, user.password);

  if (!match) return res.send("Wrong password");

  req.session.user = user;
  res.redirect("/items");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// ======================
// LISTINGS
// ======================

// View listings
app.get("/items", async (req, res) => {
  const items = await db.query("SELECT * FROM items");
  res.render("items", { items, user: req.session.user });
});

// Create form
app.get("/create", (req, res) => {
  res.render("create");
});

// Create listing
app.post("/items", upload.single("photo"), async (req, res) => {
  const {
    food_name,
    description,
    quantity,
    best_before,
    collection_location,
    collection_times
  } = req.body;

  const photo = req.file ? "/uploads/" + req.file.filename : null;

  await db.query(
    `INSERT INTO items 
    (name, description, quantity, best_before, collection_location, collection_times, photo_url) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [food_name, description, quantity, best_before, collection_location, collection_times, photo]
  );

  res.redire

module.exports = app;