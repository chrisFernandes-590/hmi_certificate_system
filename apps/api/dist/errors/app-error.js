export class AppError extends Error {
    statusCode;
    details;
    code;
    constructor(statusCode, message, details, code) {
        if (statusCode < 400 || statusCode > 599) {
            throw new RangeError('AppError statusCode must be an HTTP error status (400-599)');
        }
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.details = details;
        this.code = code;
    }
}
