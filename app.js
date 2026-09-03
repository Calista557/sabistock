import "dotenv/config";
import express from "express";
import connectDB from "./config/db.js";

connectDB();

const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send("Welcome to Sabistock");
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
