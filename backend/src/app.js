import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";

import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";

import { apiLimiter, authLimiter } from "./middlewares/rateLimiter.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";

import cookieParser from 'cookie-parser';

import morganMiddleware from "./middlewares/morganMiddleware.js";

const app = express();

app.use(cookieParser());

app.use(morganMiddleware);

//Set Security HTTP Headers (crossOriginResourcePolicy: false allows loading CDN images)
app.use(helmet({ crossOriginResourcePolicy: false }));

// Configure CORS
const allowedOrigins = [
  "http://localhost:5173", // Vite local development server
  "http://localhost:5174", // Vite local development server (alternative port)
  "http://localhost:5175", // Vite local development server (alternative port)
  "http://localhost:5000", // Swagger UI
  process.env.CLIENT_URL, // Production frontend URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like Postman or mobile apps) or matching frontend origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation: Access denied"));
      }
    },
    credentials: true,
  }),
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Sanitize inputs against NoSQL query injection (Express 5 compatible)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});

// Global API Rate Limiter
app.use("/api", apiLimiter);

// API Routes
app.use("/api/v1/auth", authLimiter, authRoutes); // Apply strict limiter to auth
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/upload", uploadRoutes);

// Server Health Check
app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "success", message: "NovaShop API server is healthy" });
});

// Centralized Error Handling Middleware (MUST be last)
app.use(errorMiddleware);

export default app;
