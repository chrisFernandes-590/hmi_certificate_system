import { getCookie } from 'hono/cookie';
import { AppError } from '../errors/app-error.js';
export function createAuthMiddleware(provider, cognitoVerifier, identityService) {
    return async (c, next) => {
        const authorization = c.req.header('authorization');
        const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        const native = c.req.header('x-auth-client') === 'native';
        const token = bearer ?? (native ? undefined : getCookie(c, 'titlecert_session') ?? getCookie(c, '__Host-titlecert_session'));
        if (!token)
            throw new AppError(401, 'Authentication required');
        // 1. Check if token is a Cognito JWT
        if (cognitoVerifier && identityService && token.split('.').length === 3) {
            const claims = await cognitoVerifier.verify(token);
            if (claims) {
                const user = await identityService.resolveUserFromClaims(claims);
                if (user) {
                    c.set('authUser', user);
                    c.set('authSessionToken', token);
                    return next();
                }
            }
        }
        // 2. Fall back to local session store
        const user = await provider.getSession(token);
        if (!user)
            throw new AppError(401, 'Session is invalid or expired');
        c.set('authUser', user);
        c.set('authSessionToken', token);
        await next();
    };
}
export function createCsrfMiddleware(webOrigin) {
    return async (c, next) => {
        if (c.req.header('x-auth-client') === 'native' || c.req.header('authorization')?.startsWith('Bearer '))
            return next();
        const origin = c.req.header('origin');
        let originMatches = false;
        try {
            originMatches = new URL(origin ?? '').origin === webOrigin;
        }
        catch { /* malformed origins are rejected */ }
        if (!originMatches)
            throw new AppError(403, 'Request origin is not allowed');
        await next();
    };
}
