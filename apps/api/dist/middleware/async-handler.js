export function asyncHandler(handler) {
    const invoke = handler;
    const wrapped = async (...args) => await invoke(...args);
    return wrapped;
}
