// src/config/env.ts

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().default(5000),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET should be at least 32 characters"),

  CRON_SECRET: z
    .string()
    .min(32, "CRON_SECRET should be at least 32 characters"),

  APP_ORIGIN: z
    .string()
    .min(1, "APP_ORIGIN is required"),

  PUBLIC_BASE_URL: z
    .string()
    .url()
    .optional(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z
    .string()
    .optional(),

  CLOUDINARY_API_KEY: z
    .string()
    .optional(),

  CLOUDINARY_API_SECRET: z
    .string()
    .optional(),

  // Social OAuth (optional until connected)
  FACEBOOK_CLIENT_ID: z
    .string()
    .optional(),

  FACEBOOK_CLIENT_SECRET: z
    .string()
    .optional(),

  INSTAGRAM_CLIENT_ID: z
    .string()
    .optional(),

  INSTAGRAM_CLIENT_SECRET: z
    .string()
    .optional(),

  LINKEDIN_CLIENT_ID: z
    .string()
    .optional(),

  LINKEDIN_CLIENT_SECRET: z
    .string()
    .optional(),

  X_CLIENT_ID: z
    .string()
    .optional(),

  X_CLIENT_SECRET: z
    .string()
    .optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Environment validation failed:\n",
    parsed.error.flatten().fieldErrors
  );

  process.exit(1);
}

export const env = parsed.data;
