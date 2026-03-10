import multer, { FileFilterCallback } from "multer";
import { Request } from "express";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and Word documents (.doc, .docx) are allowed."));
  }
};

// Files are buffered in memory and uploaded to S3 in the controller
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter,
});
