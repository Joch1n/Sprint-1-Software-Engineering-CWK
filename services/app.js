"use strict";
 
// =============================================================================
// services/app.js — CLEAN VERSION
// All duplicate config removed. Mock data removed. Routes fixed.
// This file is exported and used by server.js
// =============================================================================
 
const express = require("express");
const path    = require("path");
const bcrypt  = require("bcrypt");
const multer  = require("multer");
const session = require("express-session");
const db      = require("../models/db");
 
const app = express();
 
// =============================================================================
// MIDDLEWARE
// =============================================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
 
app.use(session({
  secret: process.env.SESSION_SECRET || "secret123",
  resave: false,
  saveUninitialized: false,
}));
 
// =============================================================================
// VIEW ENGINE (set ONCE — was duplicated before)
// =============================================================================
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "../views"));
 
// =============================================================================
// FILE UPLOAD (MULTER)
// =============================================================================
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../public/uploads/"),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });
 
// =============================================================================
// AUTH MIDDLEWARE
// =============================================================================
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}
 
// =============================================================================
// ROUTES
// =============================================================================
 
// HOME
app.get("/", (req, res) => {
  db.query("SELECT * FROM food_listings ORDER BY created_at DESC LIMIT 6",
    (err, results) => {
      if (err) { console.error(err); return res.status(500).send("Database error"); }
      res.render("index", { listings: results, user: req.session.user });
    }
  );
});
 
// ── AUTH ──────────────────────────────────────────────────────────────────────
 
app.get("/login",  (req, res) => res.render("login",  { error: null }));
app.get("/signup", (req, res) => res.render("signup", { error: null }));
 
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.render("signup", { error: "All fields are required" });
 
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hash]
    );
    res.redirect("/login");
  } catch (err) {
    console.error("Signup error:", err);
    res.render("signup", { error: "Error creating account. Email may already be registered." });
  }
});
 
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.render("login", { error: "Email and password are required" });
 
    const users = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.render("login", { error: "User not found" });
 
    const user  = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render("login", { error: "Wrong password" });
 
    req.session.user = { id: user.id, username: user.username, email: user.email };
    res.redirect("/foodlistings");
  } catch (err) {
    console.error("Login error:", err);
    res.render("login", { error: "Server error. Please try again." });
  }
});
 
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});
 
// ── FOOD LISTINGS (with search) ───────────────────────────────────────────────
 
app.get("/foodlistings", requireLogin, async (req, res) => {
  try {
    const search = req.query.search || "";
    let sql, params;
 
    if (search) {
      const like = `%${search}%`;
      sql    = `SELECT * FROM food_listings
                WHERE (food_name LIKE ? OR category LIKE ? OR postcode LIKE ?)
                AND status = 'available' ORDER BY created_at DESC`;
      params = [like, like, like];
    } else {
      sql    = "SELECT * FROM food_listings WHERE status = 'available' ORDER BY created_at DESC";
      params = [];
    }
 
    const listings = await db.query(sql, params);
    res.render("foodlistings", { listings, user: req.session.user, search });
  } catch (err) {
    console.error("Food listings error:", err);
    res.status(500).send("Database error");
  }
});
 
// ── SINGLE ITEM + REVIEWS ─────────────────────────────────────────────────────
 
// FIXED: was "/item:id" (missing slash) — now correctly "/item/:id"
app.get("/item/:id", requireLogin, async (req, res) => {
  try {
    const id       = req.params.id;
    const listings = await db.query("SELECT * FROM food_listings WHERE id = ?", [id]);
    if (listings.length === 0) return res.status(404).send("Item not found");
 
    const reviews = await db.query(
      `SELECT r.*, u.username
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.listing_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    );
 
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;
 
    res.render("item", { item: listings[0], reviews, avgRating, user: req.session.user });
  } catch (err) {
    console.error("Item page error:", err);
    res.status(500).send("Database error");
  }
});
 
app.post("/item/:id/review", requireLogin, async (req, res) => {
  try {
    const listing_id  = req.params.id;
    const reviewer_id = req.session.user.id;
    const { rating, comment } = req.body;
 
    if (!rating || !comment || comment.trim() === "") return res.redirect(`/item/${listing_id}`);
 
    const ratingNum = parseInt(rating);
    if (ratingNum < 1 || ratingNum > 5) return res.redirect(`/item/${listing_id}`);
 
    await db.query(
      "INSERT INTO reviews (listing_id, reviewer_id, rating, comment) VALUES (?, ?, ?, ?)",
      [listing_id, reviewer_id, ratingNum, comment.trim()]
    );
    res.redirect(`/item/${listing_id}`);
  } catch (err) {
    console.error("Review error:", err);
    res.redirect(`/item/${req.params.id}`);
  }
});
 
// ── CREATE LISTING ────────────────────────────────────────────────────────────
 
app.get("/create", requireLogin, (req, res) => {
  res.render("create", { user: req.session.user, error: null });
});
 
// FIXED: was inserting into wrong table "items" with wrong column names
app.post("/create", requireLogin, upload.single("photo"), async (req, res) => {
  try {
    const { food_name, description, category, postcode, quantity, expiry_date } = req.body;
    const user_id = req.session.user.id;
    const image   = req.file ? "/uploads/" + req.file.filename : null;
 
    if (!food_name || !description)
      return res.render("create", { user: req.session.user, error: "Name and description are required" });
 
    // Geocode postcode via OpenStreetMap Nominatim (free, no API key needed)
    let lat = null, lon = null;
    try {
      const geoRes  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)}&format=json&limit=1`,
        { headers: { "User-Agent": "ZeroWasteConnect/1.0" } }
      );
      const geoData = await geoRes.json();
      if (geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lon = parseFloat(geoData[0].lon);
      }
    } catch (geoErr) {
      console.warn("Geocoding failed (non-fatal):", geoErr.message);
    }
 
    await db.query(
      `INSERT INTO food_listings
         (user_id, food_name, description, category, postcode, image, quantity, expiry_date, status, lat, lon)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
      [user_id, food_name, description, category, postcode, image, quantity || 1, expiry_date || null, lat, lon]
    );
 
    res.redirect("/foodlistings");
  } catch (err) {
    console.error("Create listing error:", err);
    res.render("create", { user: req.session.user, error: "Error creating listing. Please try again." });
  }
});
 
// ── LOCATION API ──────────────────────────────────────────────────────────────
 
app.get("/api/location", async (req, res) => {
  try {
    const { postcode } = req.query;
    if (!postcode) return res.status(400).json({ error: "Postcode required" });
 
    const geoRes  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)}&format=json&limit=1`,
      { headers: { "User-Agent": "ZeroWasteConnect/1.0" } }
    );
    const geoData = await geoRes.json();
 
    if (geoData.length === 0) return res.status(404).json({ error: "Postcode not found" });
 
    res.json({ lat: geoData[0].lat, lon: geoData[0].lon, display_name: geoData[0].display_name });
  } catch (err) {
    console.error("Location API error:", err);
    res.status(500).json({ error: "Location lookup failed" });
  }
});
 
// ── MISC ──────────────────────────────────────────────────────────────────────
 
app.get("/dbtest", (req, res) => {
  db.query("SELECT 1", (err) => {
    if (err) return res.send("Database FAILED: " + err.message);
    res.send("Database CONNECTED ✓");
  });
});
 
app.get("/test", (req, res) => res.send("TEST ROUTE WORKS ✓"));
 
// =============================================================================
module.exports = app;
 