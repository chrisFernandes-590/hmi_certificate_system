export function requireProfileType(service, type) {
    return async (c, next) => {
        if (service)
            await service.assertActiveType(c.get("authUser").id, c.get("authSessionToken"), type);
        await next();
    };
}
