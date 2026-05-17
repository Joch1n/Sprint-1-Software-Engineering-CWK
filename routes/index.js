"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const multer = require("multer");
const session = require("express-session");
const db = require("../models/db");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "zerowaste-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 }
}));

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "../views"));

const uploadDir = path.join(__dirname, "../public/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`);
  }
});
const upload = multer({ storage });

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function requireLoginApi(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Login required" });
  next();
}

async function query(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

async function geocodePostcode(postcode) {
  if (!postcode) return null;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)}&format=json&limit=1&countrycodes=gb`;
  const response = await fetch(url, {
    headers: { "User-Agent": "ZeroWasteConnect/1.0 coursework app" }
  });
  if (!response.ok) return null;
  const results = await response.json();
  if (!results.length) return null;
  return {
    lat: Number(results[0].lat),
    lon: Number(results[0].lon),
    displayName: results[0].display_name
  };
}

function distanceMiles(fromLat, fromLon, toLat, toLon) {
  if ([fromLat, fromLon, toLat, toLon].some((value) => value === null || value === undefined || Number.isNaN(Number(value)))) {
    return null;
  }

  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const dLat = toRadians(Number(toLat) - Number(fromLat));
  const dLon = toRadians(Number(toLon) - Number(fromLon));
  const lat1 = toRadians(Number(fromLat));
  const lat2 = toRadians(Number(toLat));
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get("/", async (req, res) => {
  try {
    const listings = await query(
      "SELECT * FROM food_listings WHERE status = 'available' ORDER BY created_at DESC LIMIT 6"
    );
    res.render("index", { listings, user: req.session.user });
  } catch (err) {
    console.error("Home page error:", err);
    res.status(500).send("Database error");
  }
});

app.get("/signup", (req, res) => {
  if (req.session.user) return res.redirect("/foodlistings");
  res.render("signup", { error: null, user: req.session.user });
});

app.post("/signup", async (req, res) => {
  try {
    const username = req.body.username || req.body.name;
    const { email, password, postcode } = req.body;
    const confirmPassword = req.body.confirmPassword;

    if (!username || !email || !password) {
      return res.render("signup", { error: "All fields are required", user: null });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.render("signup", { error: "Passwords do not match", user: null });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUsers = await query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
    if (existingUsers.length) {
      return res.render("signup", {
        error: "That email is already registered. Please log in instead.",
        user: null
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      "INSERT INTO users (username, email, password, postcode) VALUES (?, ?, ?, ?)",
      [username.trim(), normalizedEmail, hashedPassword, postcode ? postcode.trim().toUpperCase() : null]
    );

    req.session.user = {
      id: result.insertId,
      username: username.trim(),
      name: username.trim(),
      email: normalizedEmail,
      avatar: null
    };

    res.redirect("/foodlistings");
  } catch (err) {
    console.error("Signup error:", err);
    res.render("signup", {
      error: "Could not create account. The email may already be registered.",
      user: null
    });
  }
});

app.get("/login", (req, res) => {
  res.render("login", { error: null, user: req.session.user });
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.render("login", { error: "Email and password are required", user: null });
    }

    const users = await query("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    if (!users.length) {
      return res.render("login", { error: "Invalid email or password", user: null });
    }

    const user = users[0];
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.render("login", {
        error: "Account locked after 3 failed attempts. Try again in 5 minutes.",
        user: null
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      const failedAttempts = Number(user.failed_attempts || 0) + 1;
      const lockedUntil = failedAttempts >= 3 ? new Date(Date.now() + 5 * 60 * 1000) : null;

      await query(
        "UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?",
        [failedAttempts, lockedUntil, user.id]
      );

      const message = failedAttempts >= 3
        ? "Account locked after 3 failed attempts. Try again in 5 minutes."
        : `Invalid email or password. Attempts: ${failedAttempts}/3`;

      return res.render("login", { error: message, user: null });
    }

    await query("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?", [user.id]);
    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.username,
      email: user.email,
      avatar: user.avatar
    };

    res.redirect("/foodlistings");
  } catch (err) {
    console.error("Login error:", err);
    res.render("login", { error: "Login failed. Please try again.", user: null });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/foodlistings", requireLogin, async (req, res) => {
  try {
    const listingResults = await getListingResults(req.query);

    res.render("foodlistings", {
      listings: listingResults.listings,
      user: req.session.user,
      search: listingResults.search,
      postcode: listingResults.postcode,
      radius: listingResults.radius,
      locationText: listingResults.locationText
    });
  } catch (err) {
    console.error("Food listings error:", err);
    res.status(500).send("Database error");
  }
});

async function getListingResults(queryParams) {
  const search = (queryParams.search || "").trim();
  const postcode = (queryParams.postcode || "").trim();
  const radius = Number(queryParams.radius || 10);
  const params = [];
  const conditions = ["status = 'available'"];

  if (search) {
    const like = `%${search}%`;
    conditions.push("(food_name LIKE ? OR category LIKE ? OR postcode LIKE ?)");
    params.push(like, like, like);
  }

  const listings = await query(
    `SELECT * FROM food_listings WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
    params
  );

  let locationText = null;
  let filteredListings = listings;
  let origin = null;

  if (postcode) {
    const location = await geocodePostcode(postcode);
    if (location) {
      origin = location;
      filteredListings = listings
        .map((listing) => {
          const distance = distanceMiles(location.lat, location.lon, listing.lat, listing.lon);
          return {
            ...listing,
            distance,
            distanceText: distance === null ? "Distance unavailable" : `${distance.toFixed(1)} miles away`
          };
        })
        .filter((listing) => listing.distance === null || listing.distance <= radius)
        .sort((a, b) => (a.distance ?? Number.MAX_VALUE) - (b.distance ?? Number.MAX_VALUE));
      locationText = `Showing listings within ${radius} miles of ${postcode.toUpperCase()}`;
    } else {
      locationText = "Postcode could not be found by the location API.";
    }
  }

  return { listings: filteredListings, search, postcode, radius, locationText, origin };
}

app.get("/item/:id", requireLogin, async (req, res) => {
  try {
    const listingId = req.params.id;
    const listings = await query(
      `SELECT f.*, u.username AS owner_username
       FROM food_listings f
       LEFT JOIN users u ON f.user_id = u.id
       WHERE f.id = ?`,
      [listingId]
    );

    if (!listings.length) {
      return res.status(404).render("item", {
        item: null,
        reviews: [],
        avgRating: null,
        user: req.session.user,
        error: null
      });
    }

    const reviews = await query(
      `SELECT r.*, u.username
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.listing_id = ?
       ORDER BY r.created_at DESC`,
      [listingId]
    );

    const averageRows = await query(
      "SELECT ROUND(AVG(rating), 1) AS avgRating FROM reviews WHERE listing_id = ?",
      [listingId]
    );

    res.render("item", {
      item: listings[0],
      reviews,
      avgRating: averageRows[0].avgRating,
      user: req.session.user,
      error: req.query.error || null,
      messageStatus: req.query.message || null
    });
  } catch (err) {
    console.error("Item page error:", err);
    res.status(500).send("Database error");
  }
});

app.get("/messages", requireLogin, async (req, res) => {
  try {
    const messages = await query(
      `SELECT *
       FROM messages
       WHERE receiver_id = ? OR sender_id = ?
       ORDER BY created_at DESC`,
      [req.session.user.id, req.session.user.id]
    );

    res.render("messages", {
      user: req.session.user,
      messages
    });

  } catch (err) {
    console.error(err);

    res.render("messages", {
      user: req.session.user,
      messages: [],
      error: "Could not load messages"
    });
  }
});

app.post("/item/:id/review", requireLogin, async (req, res) => {
  try {
    const listingId = req.params.id;
    const rating = Number(req.body.rating);
    const comment = (req.body.comment || "").trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) {
      return res.redirect(`/item/${listingId}?error=Review requires a rating from 1 to 5 and a comment`);
    }

    const listings = await query("SELECT id FROM food_listings WHERE id = ?", [listingId]);
    if (!listings.length) return res.status(404).send("Item not found");

    await query(
      "INSERT INTO reviews (listing_id, reviewer_id, rating, comment) VALUES (?, ?, ?, ?)",
      [listingId, req.session.user.id, rating, comment]
    );

    res.redirect(`/item/${listingId}`);
  } catch (err) {
    console.error("Review submit error:", err);
    res.redirect(`/item/${req.params.id}?error=Could not save review`);
  }
});

app.get("/api/listings", requireLoginApi, async (req, res) => {
  try {
    const listingResults = await getListingResults(req.query);
    res.json({
      listings: listingResults.listings,
      search: listingResults.search,
      postcode: listingResults.postcode,
      radius: listingResults.radius,
      locationText: listingResults.locationText,
      origin: listingResults.origin
    });
  } catch (err) {
    console.error("Listings API error:", err);
    res.status(500).json({ error: "Could not load listings" });
  }
});

app.get("/api/item/:id/reviews", requireLoginApi, async (req, res) => {
  try {
    const reviews = await query(
      `SELECT r.id, r.listing_id, r.rating, r.comment, r.created_at, u.username
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.listing_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    const averageRows = await query(
      "SELECT ROUND(AVG(rating), 1) AS avgRating, COUNT(*) AS reviewCount FROM reviews WHERE listing_id = ?",
      [req.params.id]
    );

    res.json({
      reviews,
      avgRating: averageRows[0].avgRating,
      reviewCount: averageRows[0].reviewCount
    });
  } catch (err) {
    console.error("Reviews API error:", err);
    res.status(500).json({ error: "Could not load reviews" });
  }
});

app.post("/api/item/:id/reviews", requireLoginApi, async (req, res) => {
  try {
    const listingId = req.params.id;
    const rating = Number(req.body.rating);
    const comment = (req.body.comment || "").trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) {
      return res.status(400).json({ error: "Rating 1-5 and review comment are required" });
    }

    const listings = await query("SELECT id FROM food_listings WHERE id = ?", [listingId]);
    if (!listings.length) return res.status(404).json({ error: "Item not found" });

    const result = await query(
      "INSERT INTO reviews (listing_id, reviewer_id, rating, comment) VALUES (?, ?, ?, ?)",
      [listingId, req.session.user.id, rating, comment]
    );

    res.status(201).json({ id: result.insertId, listing_id: listingId, rating, comment });
  } catch (err) {
    console.error("Review API submit error:", err);
    res.status(500).json({ error: "Could not save review" });
  }
});

app.get("/create", requireLogin, (req, res) => {
  res.render("create", { user: req.session.user, error: null });
});

app.post("/create", requireLogin, upload.single("image"), async (req, res) => {
  try {
    const { food_name, description, category, postcode, quantity, expiry_date } = req.body;
    if (!food_name || !description || !category || !postcode) {
      return res.render("create", {
        user: req.session.user,
        error: "Food name, description, category and postcode are required"
      });
    }

    let lat = null;
    let lon = null;
    const location = await geocodePostcode(postcode);
    if (location) {
      lat = location.lat;
      lon = location.lon;
    }

    const image = req.file ? `/uploads/${req.file.filename}` : null;
    await query(
      `INSERT INTO food_listings
       (user_id, food_name, description, category, postcode, image, quantity, expiry_date, status, lat, lon)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
      [
        req.session.user.id,
        food_name.trim(),
        description.trim(),
        category.trim(),
        postcode.trim().toUpperCase(),
        image,
        quantity || null,
        expiry_date || null,
        lat,
        lon
      ]
    );

    res.redirect("/foodlistings");
  } catch (err) {
    console.error("Create listing error:", err);
    res.render("create", {
      user: req.session.user,
      error: "Could not create listing. Please try again."
    });
  }
});

app.get("/api/location", requireLoginApi, async (req, res) => {
  try {
    const location = await geocodePostcode(req.query.postcode);
    if (!location) return res.status(404).json({ error: "Postcode not found" });
    res.json(location);
  } catch (err) {
    console.error("Location API error:", err);
    res.status(500).json({ error: "Location lookup failed" });
  }
});

app.post("/item/:id/message", requireLogin, async (req, res) => {
  try {
    const listingId = req.params.id;
    const message = (req.body.message || "").trim();

    if (!message) return res.redirect(`/item/${listingId}?error=Message cannot be empty`);

    const listings = await query(
      "SELECT id, user_id FROM food_listings WHERE id = ?",
      [listingId]
    );

    if (!listings.length) return res.status(404).send("Item not found");

    const listing = listings[0];
    if (listing.user_id === req.session.user.id) {
      return res.redirect(`/item/${listingId}?error=You cannot message yourself about your own listing`);
    }

    await query(
      "INSERT INTO messages (listing_id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)",
      [listingId, req.session.user.id, listing.user_id, message]
    );

    res.redirect(`/item/${listingId}?message=sent`);
  } catch (err) {
    console.error("Message submit error:", err);
    res.redirect(`/item/${req.params.id}?error=Could not send message`);
  }
});

app.get("/messages", requireLogin, async (req, res) => {
  try {
    const conversations = await query(
      `SELECT
         m.listing_id,
         f.food_name,
         f.image,
         CASE
           WHEN m.sender_id = ? THEN m.receiver_id
           ELSE m.sender_id
         END AS other_user_id,
         CASE
           WHEN m.sender_id = ? THEN receiver.username
           ELSE sender.username
         END AS other_username,
         MAX(m.created_at) AS last_message_at,
         SUBSTRING_INDEX(GROUP_CONCAT(m.message ORDER BY m.created_at DESC SEPARATOR '||'), '||', 1) AS last_message
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       LEFT JOIN food_listings f ON m.listing_id = f.id
       WHERE m.sender_id = ? OR m.receiver_id = ?
       GROUP BY m.listing_id, f.food_name, f.image, other_user_id, other_username
       ORDER BY last_message_at DESC`,
      [req.session.user.id, req.session.user.id, req.session.user.id, req.session.user.id]
    );

    res.render("messages", {
      user: req.session.user,
      conversations,
      thread: [],
      activeConversation: null,
      error: null
    });
  } catch (err) {
    console.error("Messages page error:", err);
    res.status(500).send("Could not load messages");
  }
});

app.get("/messages/:listingId/:userId", requireLogin, async (req, res) => {
  try {
    const listingId = req.params.listingId;
    const otherUserId = req.params.userId;

    const conversations = await query(
      `SELECT
         m.listing_id,
         f.food_name,
         f.image,
         CASE
           WHEN m.sender_id = ? THEN m.receiver_id
           ELSE m.sender_id
         END AS other_user_id,
         CASE
           WHEN m.sender_id = ? THEN receiver.username
           ELSE sender.username
         END AS other_username,
         MAX(m.created_at) AS last_message_at,
         SUBSTRING_INDEX(GROUP_CONCAT(m.message ORDER BY m.created_at DESC SEPARATOR '||'), '||', 1) AS last_message
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       LEFT JOIN food_listings f ON m.listing_id = f.id
       WHERE m.sender_id = ? OR m.receiver_id = ?
       GROUP BY m.listing_id, f.food_name, f.image, other_user_id, other_username
       ORDER BY last_message_at DESC`,
      [req.session.user.id, req.session.user.id, req.session.user.id, req.session.user.id]
    );

    const thread = await query(
      `SELECT m.*, sender.username AS sender_username, receiver.username AS receiver_username, f.food_name
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       LEFT JOIN food_listings f ON m.listing_id = f.id
       WHERE m.listing_id = ?
         AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
       ORDER BY m.created_at ASC`,
      [listingId, req.session.user.id, otherUserId, otherUserId, req.session.user.id]
    );

    const otherUsers = await query("SELECT id, username FROM users WHERE id = ?", [otherUserId]);
    const listings = await query("SELECT id, food_name FROM food_listings WHERE id = ?", [listingId]);

    res.render("messages", {
      user: req.session.user,
      conversations,
      thread,
      activeConversation: {
        listingId,
        otherUserId,
        otherUsername: otherUsers[0] ? otherUsers[0].username : "User",
        foodName: listings[0] ? listings[0].food_name : "Listing"
      },
      error: null
    });
  } catch (err) {
    console.error("Message thread error:", err);
    res.status(500).send("Could not load message thread");
  }
});

app.post("/messages/:listingId/:userId", requireLogin, async (req, res) => {
  try {
    const listingId = req.params.listingId;
    const receiverId = req.params.userId;
    const message = (req.body.message || "").trim();

    if (!message) return res.redirect(`/messages/${listingId}/${receiverId}`);

    await query(
      "INSERT INTO messages (listing_id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)",
      [listingId, req.session.user.id, receiverId, message]
    );

    res.redirect(`/messages/${listingId}/${receiverId}`);
  } catch (err) {
    console.error("Message reply error:", err);
    res.redirect("/messages");
  }
});

app.get("/api/messages", requireLoginApi, async (req, res) => {
  try {
    const messages = await query(
      `SELECT m.*, f.food_name, sender.username AS sender_username, receiver.username AS receiver_username
       FROM messages m
       LEFT JOIN food_listings f ON m.listing_id = f.id
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.sender_id = ? OR m.receiver_id = ?
       ORDER BY m.created_at DESC`,
      [req.session.user.id, req.session.user.id]
    );

    res.json({ messages });
  } catch (err) {
    console.error("Messages API error:", err);
    res.status(500).json({ error: "Could not load messages" });
  }
});

app.post("/api/messages", requireLoginApi, async (req, res) => {
  try {
    const listingId = req.body.listing_id;
    const receiverId = req.body.receiver_id;
    const message = (req.body.message || "").trim();

    if (!listingId || !receiverId || !message) {
      return res.status(400).json({ error: "listing_id, receiver_id and message are required" });
    }

    const result = await query(
      "INSERT INTO messages (listing_id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)",
      [listingId, req.session.user.id, receiverId, message]
    );

    res.status(201).json({ id: result.insertId, listing_id: listingId, receiver_id: receiverId, message });
  } catch (err) {
    console.error("Message API submit error:", err);
    res.status(500).json({ error: "Could not send message" });
  }
});

app.get("/reviews", requireLogin, (req, res) => {
  res.redirect("/foodlistings");
});

app.get("/dbtest", async (req, res) => {
  try {
    await query("SELECT 1");
    res.send("Database connected");
  } catch (err) {
    res.status(500).send(`Database failed: ${err.message}`);
  }
});

module.exports = app;
