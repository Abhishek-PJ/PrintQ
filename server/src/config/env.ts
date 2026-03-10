import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/printq",
  jwtSecret: process.env.JWT_SECRET || "change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  nodeEnv: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  seedAdminName: process.env.SEED_ADMIN_NAME || "PrintQ Admin",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || "admin@printq.local",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "Admin@123",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  awsRegion: process.env.AWS_REGION || "us-east-1",
  awsS3Bucket: process.env.AWS_S3_BUCKET || "",
  awsCloudfrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN || ""
};
