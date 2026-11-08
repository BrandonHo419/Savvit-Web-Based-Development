const { reject } = require('./authThrottle');

class PasswordBusyError extends Error {
  constructor() { super('Authentication capacity reached'); }
}

function createPasswordWork(limit = 4) {
  let active = 0;
  return async function passwordWork(operation) {
    if (active >= limit) throw new PasswordBusyError();
    active++;
    try { return await operation(); }
    finally { active--; }
  };
}

const passwordWork = createPasswordWork();
function passwordWorkError(error, req, res, next) {
  if (error instanceof PasswordBusyError) return reject(res, 503, 5);
  next(error);
}

module.exports = { passwordWork, passwordWorkError, createPasswordWork, PasswordBusyError };
