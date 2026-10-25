import { AppError } from "../../errors/app-error.js";
export class DisabledEmailProvider {
    async sendVerificationEmail() {
        throw new AppError(503, "Email delivery is not configured. Please contact support to complete account verification.");
    }
    async sendPasswordResetEmail() {
        throw new AppError(503, "Email delivery is not configured. Please contact support to reset your password.");
    }
}
export class DevelopmentConsoleEmailProvider {
    async sendVerificationEmail(email, verificationUrl) {
        console.info(`[development email] Verification link for ${email}: ${verificationUrl}`);
    }
    async sendPasswordResetEmail(email, resetUrl) {
        console.info(`[development email] Password reset link for ${email}: ${resetUrl}`);
    }
}
