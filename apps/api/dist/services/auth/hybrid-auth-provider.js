/**
 * HybridAuthProvider combines local database session authentication
 * with external identity provider (Amazon Cognito) JWT verification.
 * Follows AGENTS.md rules for provider independence and immutable user UUIDs.
 */
export class HybridAuthProvider {
    localAuth;
    cognitoVerifier;
    identityService;
    constructor(localAuth, cognitoVerifier, identityService) {
        this.localAuth = localAuth;
        this.cognitoVerifier = cognitoVerifier;
        this.identityService = identityService;
    }
    register(input) {
        return this.localAuth.register(input);
    }
    verifyEmail(token) {
        return this.localAuth.verifyEmail(token);
    }
    authenticate(email, password) {
        return this.localAuth.authenticate(email, password);
    }
    endSession(sessionToken) {
        return this.localAuth.endSession(sessionToken);
    }
    requestPasswordReset(email) {
        return this.localAuth.requestPasswordReset(email);
    }
    completePasswordReset(token, newPassword) {
        return this.localAuth.completePasswordReset(token, newPassword);
    }
    async getSession(token) {
        if (!token || typeof token !== "string")
            return undefined;
        // 1. If token is a 3-part JWT and Cognito is configured, verify via Cognito
        if (this.cognitoVerifier && this.identityService && token.split(".").length === 3) {
            const claims = await this.cognitoVerifier.verify(token);
            if (claims) {
                const user = await this.identityService.resolveUserFromClaims(claims);
                if (user)
                    return user;
            }
        }
        // 2. Fall back to local session store (e.g. 43-character base64url tokens)
        return this.localAuth.getSession(token);
    }
}
