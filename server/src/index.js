import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { Server } from "socket.io";

import { connectDB } from "./config/db.js";
import { getFirebaseAdmin, initFirebase } from "./config/firebase.js";
import { setSocketIO } from "./services/notifications.js";
import User from "./models/User.js";

import authRoutes from "./routes/authRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import {
  notificationRoutes,
  exportRoutes,
} from "./routes/notificationRoutes.js";

function normalizeOrigin(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
    return url.origin;
  } catch {
    console.warn(`[CORS] Ignoring invalid CLIENT_URL value: ${value}`);
    return null;
  }
}

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

function corsOrigin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error("Origin not allowed by CORS"));
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: corsOrigin, credentials: true },
});

setSocketIO(io);

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  const admin = getFirebaseAdmin();
  if (!admin) return next(new Error("Socket authentication unavailable"));
  if (typeof token !== "string" || !token) {
    return next(new Error("Socket authentication required"));
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return next(new Error("Invalid socket token"));
  }

  try {
    const user = await User.findOne({ firebaseUid: decoded.uid })
      .select("firebaseUid role status")
      .lean();
    if (!user || user.status !== "active") {
      return next(new Error("Socket access denied"));
    }

    socket.data.firebaseUid = user.firebaseUid;
    socket.data.role = user.role;
    next();
  } catch (error) {
    console.error("[Socket] Authentication lookup failed:", error);
    next(new Error("Socket authentication failed"));
  }
});

io.on("connection", (socket) => {
  socket.join(`role:${socket.data.role}`);
  socket.join(`user:${socket.data.firebaseUid}`);
});

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(morgan("dev"));
app.use(express.json());

app.use((req, _res, next) => {
  if (req.method !== "OPTIONS" && req.headers["user-agent"]) {
    console.log(`[UA-DEBUG] ${req.method} ${req.originalUrl} | IP=${req.ip} | UA=${req.headers["user-agent"]}`);
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/export", exportRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000;

async function start() {
  initFirebase();
  await connectDB();

  httpServer.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

start();
