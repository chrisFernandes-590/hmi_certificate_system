export class DisabledEmailProvider {
    async sendVerificationEmail() { }
    async sendPasswordResetEmail() { }
}
export class DevelopmentConsoleEmailProvider {
    async sendVerificationEmail(email, verificationUrl) {
        console.info(`[development email] Verification link for ${email}: ${verificationUrl}`);
    }
    async sendPasswordResetEmail(email, resetUrl) {
        console.info(`[development email] Password reset link for ${email}: ${resetUrl}`);
    }
}
