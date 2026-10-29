import { CognitoJwtVerifier } from "aws-jwt-verify";

export type VerifiedCognitoClaims = {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  tokenUse: "id" | "access";
};

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedCognitoClaims | null>;
}

export class CognitoTokenVerifier implements TokenVerifier {
  private readonly idVerifier: ReturnType<typeof CognitoJwtVerifier.create>;
  private readonly accessVerifier: ReturnType<typeof CognitoJwtVerifier.create>;

  constructor(userPoolId: string, clientId: string) {
    this.idVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: "id",
      clientId,
    });
    this.accessVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: "access",
      clientId,
    });
  }

  async verify(token: string): Promise<VerifiedCognitoClaims | null> {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // 1. Try ID token verification first (contains profile & email claims)
    try {
      const payload = await this.idVerifier.verify(token);
      return {
        sub: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
        emailVerified: Boolean(payload.email_verified),
        name: typeof payload.name === "string" ? payload.name : undefined,
        tokenUse: "id",
      };
    } catch {
      // 2. Try Access token verification
      try {
        const payload = await this.accessVerifier.verify(token);
        return {
          sub: payload.sub,
          tokenUse: "access",
        };
      } catch {
        return null;
      }
    }
  }
}
