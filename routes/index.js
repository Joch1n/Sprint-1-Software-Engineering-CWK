const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
const PORT = 3001;

console.log("INDEX.JS RUNNING");

// MIDDLEWARE
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
  })
);

// VIEW ENGINE
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// DATABASE CONNECTION
const db = mysql.createPool({
  host: "db",
  user: "root",
  password: "password",
  database: "zerowaste",
});

// TEST DATABASE CONNECTION
db.getConnection((err, connection) => {
  if (err) {
    console.error("MYSQL CONNECTION ERROR:", err);
  } else {
    console.log("Connected to MySQL");
    connection.release();
  }
});

// LOGIN MIDDLEWARE
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
}

// HOME PAGE
app.get("/", (req, res) => {

  db.query("SELECT * FROM Food_Listings", (err, results) => {

    if (err) {
      return res.status(500).send("Database error");
    }

    res.render("index", {
      listings: results,
      user: req.session.user
    });

  });

});

// LOGIN PAGE
app.get("/login", (req, res) => {
  res.render("login");
});

// SIGNUP PAGE
app.get("/signup", (req, res) => {
  res.render("signup");
});

// SIGNUP
app.post("/signup", async (req, res) => {

  try {

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.send("All fields are required");
    }

    const hash = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO Users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hash],
      (err) => {

        if (err) {
          console.error("DB ERROR:", err);
          return res.status(500).send("Error creating user");
        }

        console.log("User Created");
        res.redirect("/login");

      }
    );

  } catch (err) {
    res.status(500).send("Server error");
  }

});

// LOGIN
app.post("/login", (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.send("Email and password required");
  }

  db.query(
    "SELECT * FROM Users WHERE email = ?",
    [email],
    async (err, results) => {

      if (err) {
        return res.send("Database error");
      }

      if (results.length === 0) {
        return res.send("User not found");
      }

      try {

        const user = results[0];

        const match = await bcrypt.compare(
          password,
          user.password
        );

        if (!match) {
          return res.send("Wrong password");
        }

        req.session.user = user;

        res.redirect("/");

      } catch {
        res.status(500).send("Login error");
      }

    }
  );

});

// LOGOUT
app.get("/logout", (req, res) => {

  req.session.destroy(() => {
    res.redirect("/login");
  });

});

// FOOD LISTINGS PAGE
app.get("/foodlistings", requireLogin, (req, res) => {

  db.query("SELECT * FROM Food_Listings", (err, results) => {

    if (err) {
      return res.send("Database error");
    }

    res.render("foodlistings", {
      listings: results,
      user: req.session.user
    });

  });

});

// SINGLE ITEM PAGE
app.get("/item/:id", (req, res) => {

  const id = req.params.id;

  db.query(
    "SELECT * FROM Food_Listings WHERE id = ?",
    [id],
    (err, results) => {

      if (err) {
        console.error(err);
        return res.status(500).send("Database error");
      }

      if (results.length === 0) {
        return res.status(404).send("Item not found");
      }

      res.render("item", {
        item: results[0],
        user: req.session.user
      });

    }
  );

});

// API - SAVINGS FEATURE
app.get("/api/savings", (req, res) => {

  db.query(
    "SELECT food_name FROM Food_Listings",
    (err, results) => {

      if (err) {
        return res.status(500).json({
          error: "Database error"
        });
      }

      const data = results.map(item => ({
        food: item.food_name,
        price: "FREE",
        estimatedSaving: "£5-£15 saved"
      }));

      res.json(data);

    }
  );

});

// DATABASE TEST
app.get("/dbtest", (req, res) => {

  db.query("SELECT 1", (err, results) => {

    if (err) {
      return res.send("Database FAILED");
    }

    res.send("Database CONNECTED");

  });

});

// TEST ROUTE
app.get("/test", (req, res) => {
  res.send("TEST ROUTE WORKS");
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});