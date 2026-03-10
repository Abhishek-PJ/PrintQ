import bcrypt from "bcryptjs";
import { connectDB } from "../config/db";
import { env } from "../config/env";
import { User } from "../models/User";

const seedSuperAdmin = async (): Promise<void> => {
  await connectDB();

  const existingAdmin = await User.findOne({ email: env.seedAdminEmail });
  if (existingAdmin) {
    // eslint-disable-next-line no-console
    console.log(`SuperAdmin already exists: ${env.seedAdminEmail}`);
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(env.seedAdminPassword, 10);

  await User.create({
    name: env.seedAdminName,
    email: env.seedAdminEmail,
    password: hashedPassword,
    role: "superadmin"
  });

  // eslint-disable-next-line no-console
  console.log(`SuperAdmin seeded successfully: ${env.seedAdminEmail}`);
  process.exit(0);
};

seedSuperAdmin().catch((error: Error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to seed superadmin:", error.message);
  process.exit(1);
});
