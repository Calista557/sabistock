import "dotenv/config"; 
import express from "express";
import connectDB from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import stockCountRoutes from "./routes/stockCountRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import debtRoutes from "./routes/debtRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import customerDebtRoutes from "./routes/customerDebtRoutes.js";


connectDB();

const app = express();

app.use(express.json());
app.use("/api/products", productRoutes);
app.use("/api/stock-counts", stockCountRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/customer-debts", customerDebtRoutes);

const port = 3000;

app.get("/", (req, res) => {
  res.send("Welcome to Sabistock");
});

app.post("/test", (req, res) => {
  console.log(req.body);
  res.send("Data received");
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
