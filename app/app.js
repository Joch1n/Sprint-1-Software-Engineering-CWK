"use strict";

const express = require("express");
const app = express();
const db = require("./services/db");

// Serve static files (CSS, JS, images)
app.use(express.static("static"));

// Set Pug as the view engine
app.set("view engine", "pug");
app.set("views", __dirname + "/views");

// ===== ROUTES =====

// Root route - homepage
app.get("/", async (req, res) => {
  try {
    const results = await db.query("SELECT 1 + 1 AS solution");
    res.render("index", { message: `Hello! DB test: 1 + 1 = ${results[0].solution}` });
  } catch (err) {
    console.error(err);
    res.send("Database error");
  }
});

// Test database route
app.get("/db_test", async (req, res) => {
  try {
    const results = await db.query("SELECT * FROM test_table");
    console.log(results);
    res.send(results);
  } catch (err) {
    console.error(err);
    res.send("Database error");
  }
});

// Goodbye route
app.get("/goodbye", (req, res) => {
  res.send("Goodbye world!");
});

// Dynamic hello route
app.get("/hello/:name", (req, res) => {
  const name = req.params.name;
  console.log(req.params);
  res.send(`Hello ${name}`);
});

// ===== EXPORT APP =====
module.exports = app;