import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";

import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";

import { apiLimiter } from "./middlewares/rateLimiter.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import shippingRoutes from "./routes/shippingRoutes.js";
import returnRoutes from "./routes/returnRoutes.js";
import adminPaymentRoutes from "./routes/adminPaymentRoutes.js";
import adminShippingRoutes from "./routes/adminShippingRoutes.js";
import adminReturnRoutes from "./routes/adminReturnRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import homeRoutes from "./routes/homeRoutes.js";
import newsletterRoutes from "./routes/newsletterRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import discountRoutes from "./routes/discountRoutes.js";
import trackingRoutes from "./routes/trackingRoutes.js";
import adminSupportRoutes from "./routes/adminSupportRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import helpRoutes from "./routes/helpRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import { getPublicHomepageLayout, getPublicHeroSlides, trackHeroSlideEvent } from "./controllers/homeController.js";

import cookieParser from 'cookie-parser';

import morganMiddleware from "./middlewares/morganMiddleware.js";

const app = express();

// Trust reverse proxy (e.g. Vite proxy, Nginx) so client IP is accurately extracted from X-Forwarded-For
app.set('trust proxy', 1);

app.use(cookieParser());

app.use(morganMiddleware);

// Set Security HTTP Headers (crossOriginResourcePolicy: false allows loading CDN images)
app.use(helmet({ crossOriginResourcePolicy: false }));

// Configure CORS
const configuredOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
]
  .filter(Boolean)
  .flatMap((url) => url.split(',').map((u) => u.trim()))
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([
    "http://localhost:5173", // Vite local development server
    "http://localhost:5174", // Vite local development server (alternative port)
    "http://localhost:5175", // Vite local development server (alternative port)
    "http://localhost:5000", // Swagger UI
    ...configuredOrigins,
  ])
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like Postman or mobile apps), matching frontend origins, or local development origins
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation: Access denied"));
      }
    },
    credentials: true,
  }),
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(
  express.json({
    limit: "10kb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
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

// Serve local media uploads statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Public direct endpoints for Homepage, Hero Slides, and Hero telemetry
app.get(["/api/v1/homepage", "/api/homepage"], getPublicHomepageLayout);
app.get(["/api/v1/hero-slides", "/api/hero-slides"], getPublicHeroSlides);
app.post(["/api/v1/track/hero", "/api/track/hero"], trackHeroSlideEvent);

// API Routes (supports both /api/v1 and /api)
app.use(["/api/v1/auth", "/api/auth"], authRoutes);
app.use(["/api/v1/categories", "/api/categories"], categoryRoutes);
app.use(["/api/v1/products", "/api/products"], productRoutes);
app.use(["/api/v1/cart", "/api/cart"], cartRoutes);
app.use(["/api/v1/wishlist", "/api/wishlist"], wishlistRoutes);
app.use(["/api/v1/orders", "/api/orders"], orderRoutes);
app.use(["/api/v1/users", "/api/users"], userRoutes);
app.use(["/api/v1/addresses", "/api/addresses"], addressRoutes);
app.use(["/api/v1/payments", "/api/payments"], paymentRoutes);
app.use(["/api/v1/shipping", "/api/shipping"], shippingRoutes);
app.use(["/api/v1/returns", "/api/returns"], returnRoutes);
app.use(["/api/v1/admin/payments", "/api/admin/payments"], adminPaymentRoutes);
app.use(["/api/v1/admin/shipping", "/api/admin/shipping"], adminShippingRoutes);
app.use(["/api/v1/admin/returns", "/api/admin/returns"], adminReturnRoutes);
app.use(["/api/v1/admin/support", "/api/admin/support"], adminSupportRoutes);
app.use(["/api/v1/support", "/api/support"], supportRoutes);
app.use(["/api/v1/webhooks", "/api/webhooks"], webhookRoutes);
app.use(["/api/v1/help", "/api/help"], helpRoutes);
app.use(["/api/v1/settings", "/api/settings"], settingsRoutes);
app.use(["/api/v1/upload", "/api/upload"], uploadRoutes);
app.use(["/api/v1/home", "/api/home"], homeRoutes);
app.use(["/api/v1/newsletter", "/api/newsletter"], newsletterRoutes);
app.use(["/api/v1/admin", "/api/admin"], adminRoutes);
app.use(["/api/v1/reviews", "/api/reviews"], reviewRoutes);
app.use(["/api/v1/discounts", "/api/discounts"], discountRoutes);
app.use(["/api/v1/track", "/api/track"], trackingRoutes);

// Server Health Check
app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "success", message: "NovaShop API server is healthy" });
});

// Centralized Error Handling Middleware (MUST be last)
app.use(errorMiddleware);

export default app;
