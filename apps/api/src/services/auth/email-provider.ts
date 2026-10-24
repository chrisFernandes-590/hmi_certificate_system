import type { EmailProvider } from "./types.js";
import { AppError } from "../../errors/app-error.js";

export class DisabledEmailProvider implements EmailProvider {
  async sendVerificationEmail(): Promise<void> {
    throw new AppError(503, "Email delivery is not configured. Please contact support to complete account verification.");
  }

  async sendPasswordResetEmail(): Promise<void> {
    throw new AppError(503, "Email delivery is not configured. Please contact support to reset your password.");
  }
}

export class DevelopmentConsoleEmailProvider implements EmailProvider {
  async sendVerificationEmail(email: string, verificationUrl: string): Promise<void> {
    console.info(`[development email] Verification link for ${email}: ${verificationUrl}`);
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    console.info(`[development email] Password reset link for ${email}: ${resetUrl}`);
  }
}
