import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HybridAuthProvider } from '../src/services/auth/hybrid-auth-provider.js';
import type { AuthProvider, AuthSession, AuthUser } from '../src/services/auth/types.js';
import type { TokenVerifier, VerifiedCognitoClaims } from '../src/services/auth/cognito-token-verifier.js';
import type { ExternalIdentityService } from '../src/services/auth/external-identity-service.js';

test('HybridAuthProvider delegates to local session when token is not a JWT', async () => {
  const localUser: AuthUser = {
    id: 'local-user-uuid',
    name: 'Local User',
    email: 'local@example.com',
    emailVerifiedAt: new Date(),
  };

  const localAuth: AuthProvider = {
    register: async () => {},
    verifyEmail: async () => localUser,
    authenticate: async (): Promise<AuthSession> => ({
      user: localUser,
      expiresAt: new Date(Date.now() + 3600000),
      sessionToken: 'local-session-token-43chars-long-example',
    }),
    getSession: async (token: string) => (token === 'valid-local-token' ? localUser : undefined),
    endSession: async () => {},
    requestPasswordReset: async () => {},
    completePasswordReset: async () => {},
  };

  const mockVerifier: TokenVerifier = {
    verify: async () => {
      throw new Error('Verifier should not be called for non-JWT tokens');
    },
  };

  const hybrid = new HybridAuthProvider(localAuth, mockVerifier, undefined);

  // Test local token
  const result = await hybrid.getSession('valid-local-token');
  assert.equal(result?.id, 'local-user-uuid');
  assert.equal(result?.email, 'local@example.com');

  // Test invalid token
  const invalid = await hybrid.getSession('invalid-token');
  assert.equal(invalid, undefined);
});

test('HybridAuthProvider verifies Cognito JWT and resolves external identity', async () => {
  const cognitoUser: AuthUser = {
    id: 'mapped-app-uuid',
    name: 'Cognito Verified User',
    email: 'cognito@example.com',
    emailVerifiedAt: new Date(),
  };

  const localAuth: AuthProvider = {
    register: async () => {},
    verifyEmail: async () => cognitoUser,
    authenticate: async (): Promise<AuthSession> => ({
      user: cognitoUser,
      expiresAt: new Date(Date.now() + 3600000),
      sessionToken: 'token',
    }),
    getSession: async () => undefined,
    endSession: async () => {},
    requestPasswordReset: async () => {},
    completePasswordReset: async () => {},
  };

  const mockVerifier: TokenVerifier = {
    verify: async (token: string): Promise<VerifiedCognitoClaims | null> => {
      if (token === 'header.payload.signature') {
        return {
          sub: 'cognito-sub-12345',
          email: 'cognito@example.com',
          emailVerified: true,
          name: 'Cognito Verified User',
          tokenUse: 'id',
        };
      }
      return null;
    },
  };

  const mockIdentityService = {
    resolveUserFromClaims: async (claims: VerifiedCognitoClaims): Promise<AuthUser | undefined> => {
      if (claims.sub === 'cognito-sub-12345') {
        return cognitoUser;
      }
      return undefined;
    },
  } as unknown as ExternalIdentityService;

  const hybrid = new HybridAuthProvider(localAuth, mockVerifier, mockIdentityService);

  const result = await hybrid.getSession('header.payload.signature');
  assert.ok(result);
  assert.equal(result.id, 'mapped-app-uuid');
  assert.equal(result.name, 'Cognito Verified User');
  assert.equal(result.email, 'cognito@example.com');
});
