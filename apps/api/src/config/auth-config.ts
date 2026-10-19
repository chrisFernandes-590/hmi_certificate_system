import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  AUTH_WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  AUTH_APP_BASE_URL: z.string().url().default("http://localhost:5173"),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(604_800),
  AUTH_VERIFICATION_TTL_SECONDS: z.coerce.number().int().min(300).max(604_800).default(86_400),
  AUTH_PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(3_600),
  DEV_EMAIL_ENABLED: z.enum(["true", "false"]).default("false"),
});

const result = environmentSchema.safeParse(process.env);
if (!result.success) {
  throw new Error(`Invalid authentication configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
}

if (result.data.DEV_EMAIL_ENABLED === "true" && result.data.NODE_ENV !== "development") {
  throw new Error("DEV_EMAIL_ENABLED can only be enabled when NODE_ENV=development");
}

if (result.data.NODE_ENV === "production") {
  throw new Error("Production email delivery is not configured; refusing to start authentication without it");
}

export const authConfig = {
  nodeEnv: result.data.NODE_ENV,
  port: result.data.PORT,
  webOrigin: new URL(result.data.AUTH_WEB_ORIGIN).origin,
  appBaseUrl: result.data.AUTH_APP_BASE_URL.replace(/\/$/, ""),
  sessionTtlSeconds: result.data.AUTH_SESSION_TTL_SECONDS,
  verificationTtlSeconds: result.data.AUTH_VERIFICATION_TTL_SECONDS,
  passwordResetTtlSeconds: result.data.AUTH_PASSWORD_RESET_TTL_SECONDS,
  devEmailEnabled: result.data.DEV_EMAIL_ENABLED === "true",
  secureCookies: process.env.NODE_ENV === "production",
};
