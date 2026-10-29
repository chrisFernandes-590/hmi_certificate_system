import type { AuthProvider, AuthSession, AuthUser } from "./types.js";
import type { TokenVerifier } from "./cognito-token-verifier.js";
import type { ExternalIdentityService } from "./external-identity-service.js";

/**
 * HybridAuthProvider combines local database session authentication
 * with external identity provider (Amazon Cognito) JWT verification.
 * Follows AGENTS.md rules for provider independence and immutable user UUIDs.
 */
export class HybridAuthProvider implements AuthProvider {
  constructor(
    private readonly localAuth: AuthProvider,
    private readonly cognitoVerifier?: TokenVerifier,
    private readonly identityService?: ExternalIdentityService,
  ) {}

  register(input: { name: string; email: string; password: string }): Promise<void> {
    return this.localAuth.register(input);
  }

  verifyEmail(token: string): Promise<AuthUser> {
    return this.localAuth.verifyEmail(token);
  }

  authenticate(email: string, password: string): Promise<AuthSession> {
    return this.localAuth.authenticate(email, password);
  }

  endSession(sessionToken: string): Promise<void> {
    return this.localAuth.endSession(sessionToken);
  }

  requestPasswordReset(email: string): Promise<void> {
    return this.localAuth.requestPasswordReset(email);
  }

  completePasswordReset(token: string, newPassword: string): Promise<void> {
    return this.localAuth.completePasswordReset(token, newPassword);
  }

  async getSession(token: string): Promise<AuthUser | undefined> {
    if (!token || typeof token !== "string") return undefined;

    // 1. If token is a 3-part JWT and Cognito is configured, verify via Cognito
    if (this.cognitoVerifier && this.identityService && token.split(".").length === 3) {
      const claims = await this.cognitoVerifier.verify(token);
      if (claims) {
        const user = await this.identityService.resolveUserFromClaims(claims);
        if (user) return user;
      }
    }

    // 2. Fall back to local session store (e.g. 43-character base64url tokens)
    return this.localAuth.getSession(token);
  }
}
