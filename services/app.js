"use strict";

const express = require("express");
const path = require("path");
const app = express();
const db = require("../models/db");
const bcrypt = require("bcrypt");
const multer = require("multer");
const session = require("express-session");

console.log("INDEX.JS RUNNING");

//Css styling
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "../views"));


// static files
// =========================
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "secret123",
  resave: false,
  saveUninitialized: true
}));

// =========================
// VIEW ENGINE
// =========================
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "../views"));

// =========================
// FILE UPLOAD (MULTER)
// =========================
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../public/uploads/"),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// =========================
// MOCK DATA
// =========================
const mockListings = [
  {
    id: 1,
    food_name: 'Fresh Apples',
    description: 'A basket of crisp red apples from my garden.',
    postcode: 'SW1A 1AA',
    status: 'available',
    image: 'https://images.unsplash.com/photo-1560806647-441ce23f6ef0',
  },
  {
    id: 2,
    food_name: 'Homemade Bread',
    description: 'Freshly baked sourdough bread.',
    postcode: 'E1 6AN',
    status: 'available',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff',
  }
];

// =========================
// ROUTES
// =========================

// HOME (index.pug)
app.get("/", (req, res) => {
  res.render("index", { user: req.session.user });
});

// LOGIN PAGE
app.get("/login", (req, res) => {
  res.render("login");
});

// SIGNUP PAGE (FIXED)
app.get("/signup", (req, res) => {
  res.render("signup");
});

// REGISTER USER
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hash]
  );

  res.redirect("/login");
});

// LOGIN USER
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const users = await db.query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  if (users.length === 0) return res.send("User not found");

  const user = users[0];
  const match = await bcrypt.compare(password, user.password);

  if (!match) return res.send("Wrong password");

  req.session.user = user;
  res.redirect("/");
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// FOOD LISTINGS PAGE (your styled UI)
app.get("/foodlistings", (req, res) => {
  res.render("foodlistings", {
    listings: mockListings,
    user: req.session.user
  });
});

app.get("/item:id", (req, res) => {
  const item = mockListings.find(l => l.id == req.params.id);

  if(!item) return res.send("Item not found");

  res.render("item", { item, user: req.session.user });
});

// VIEW ALL ITEMS FROM DB
app.get("/items", async (req, res) => {
  const items = await db.query("SELECT * FROM items");
  res.render("items", { item, user: req.session.user });
});

// CREATE FORM PAGE
app.get("/create", (req, res) => {
  res.render("create");
});

// CREATE ITEM (UPLOAD)
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

  res.redirect("/foodlistings"); // 
});

// =========================
module.exports = app;