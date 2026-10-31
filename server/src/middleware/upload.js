import multer from "multer";

const fileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    const error = new Error("Only image files are allowed");
    error.code = "INVALID_FILE_TYPE";
    cb(error, false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default upload;

const UPLOAD_ERROR_RESPONSES = {
  LIMIT_FILE_SIZE: {
    status: 413,
    code: "UPLOAD_FILE_TOO_LARGE",
    error: "Each image must be 5 MB or smaller.",
  },
  LIMIT_FILE_COUNT: {
    status: 400,
    code: "UPLOAD_TOO_MANY_FILES",
    error: "You can upload up to 3 images per request.",
  },
  LIMIT_UNEXPECTED_FILE: {
    status: 400,
    code: "UPLOAD_UNEXPECTED_FILE",
    error: "Unexpected upload field or too many images. You can upload up to 3 images.",
  },
  LIMIT_PART_COUNT: {
    status: 400,
    code: "UPLOAD_TOO_MANY_PARTS",
    error: "The upload contains too many parts.",
  },
  LIMIT_FIELD_COUNT: {
    status: 400,
    code: "UPLOAD_TOO_MANY_FIELDS",
    error: "The upload contains too many fields.",
  },
  LIMIT_FIELD_KEY: {
    status: 400,
    code: "UPLOAD_FIELD_NAME_TOO_LONG",
    error: "An upload field name is too long.",
  },
  LIMIT_FIELD_VALUE: {
    status: 400,
    code: "UPLOAD_FIELD_VALUE_TOO_LARGE",
    error: "An upload field value is too large.",
  },
};

export function uploadErrorHandler(error, _req, res, next) {
  if (error?.code === "INVALID_FILE_TYPE") {
    return res.status(415).json({
      code: "UPLOAD_INVALID_FILE_TYPE",
      error: "Only image files are allowed.",
    });
  }

  if (!(error instanceof multer.MulterError)) return next(error);

  const response = UPLOAD_ERROR_RESPONSES[error.code];
  if (!response) return next(error);
  return res.status(response.status).json({
    code: response.code,
    error: response.error,
  });
}