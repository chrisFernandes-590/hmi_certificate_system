import { AppError } from '../errors/app-error.js';
export function successResponse(c, data, statusCode = 200) {
    if (statusCode < 200 || statusCode >= 300) {
        throw new RangeError('Success responses require an HTTP success status (2xx)');
    }
    return c.json({ success: true, data }, statusCode);
}
export function errorResponse(c, error) {
    const errorBody = {
        statusCode: error.statusCode,
        message: error.message,
        ...(error.code === undefined ? {} : { code: error.code }),
        ...(error.details === undefined ? {} : { details: error.details })
    };
    return c.json({ success: false, error: errorBody }, error.statusCode);
}
