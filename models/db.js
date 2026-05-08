"use strict";
const mysql = require("mysql2/promise");

console.log("DB_HOST:", process.env.DB_HOST);

const pool = mysql.createPool({
  host: process.env.DB_HOST || "db",
  port: 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "zerowaste",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;