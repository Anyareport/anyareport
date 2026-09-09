import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { verifyToken } from "../middleware/verifyToken.js";
import { requireRole } from "../middleware/rbac.js";
import { reportSubmitLimiter } from "../middleware/rateLimiters.js";
import {
  createReport,
  getMyReports,
  getReports,
  getReportById,
  verifyReport,
  flagReport,
  updateReportStatus,
  acknowledgeReport,
  getCategories,
  getAnalytics,
  getHeatmapData,
  classifyReportHandler,
} from "../controllers/reportController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../uploads"),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

const router = Router();

router.get("/categories", getCategories);

router.use(verifyToken);

router.post("/", reportSubmitLimiter, upload.array("photos", 3), createReport);
router.post("/classify", upload.single("photo"), classifyReportHandler);
router.get("/mine", getMyReports);
router.get(
  "/analytics",
  requireRole("admin", "captain", "secretary", "kagawad"),
  getAnalytics,
);
router.get(
  "/heatmap",
  requireRole("admin", "captain", "secretary", "kagawad"),
  getHeatmapData,
);
router.get(
  "/",
  requireRole("admin", "captain", "secretary", "kagawad", "tanod", "responder"),
  getReports,
);
router.get("/:id", getReportById);
router.post("/:id/verify", requireRole("secretary"), verifyReport);
router.post("/:id/flag", requireRole("secretary"), flagReport);
router.patch(
  "/:id/status",
  requireRole("secretary", "kagawad", "tanod", "responder"),
  updateReportStatus,
);
router.patch(
  "/:id/acknowledge",
  requireRole("tanod", "responder", "captain", "secretary"),
  acknowledgeReport,
);

export default router;
