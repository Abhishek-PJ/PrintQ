import { Schema, model, Document } from "mongoose";
import { UserRole } from "../types";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  mobile?: string;
}

const userSchema = new Schema<IUser>(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ["student", "admin", "superadmin"], default: "student" },
    mobile:   { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
