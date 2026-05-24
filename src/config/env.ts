// src/config/env.ts

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalString = z
  .string()
  .trim()
  .min(1)
  .optional();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().default(5000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET should be at least 32 characters"),

  CRON_SECRET: z
    .string()
    .min(32, "CRON_SECRET should be at least 32 characters"),

  APP_ORIGIN: z.string().min(1, "APP_ORIGIN is required"),

  PUBLIC_BASE_URL: z.string().url().optional(),

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,

  FACEBOOK_CLIENT_ID: optionalString,
  FACEBOOK_CLIENT_SECRET: optionalString,
  FACEBOOK_PAGE_ID: optionalString,
  FACEBOOK_PAGE_ACCESS_TOKEN: optionalString,

  INSTAGRAM_CLIENT_ID: optionalString,
  INSTAGRAM_CLIENT_SECRET: optionalString,
  INSTAGRAM_ACCOUNT_ID: optionalString,

  LINKEDIN_CLIENT_ID: optionalString,
  LINKEDIN_CLIENT_SECRET: optionalString,
  LINKEDIN_ACCESS_TOKEN: optionalString,
  LINKEDIN_AUTHOR_URN: optionalString,

  X_CLIENT_ID: optionalString,
  X_CLIENT_SECRET: optionalString,
  X_BEARER_TOKEN: optionalString,
  X_API_KEY: optionalString,
  X_API_SECRET: optionalString,
  X_ACCESS_TOKEN: optionalString,
  X_ACCESS_TOKEN_SECRET: optionalString,
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
