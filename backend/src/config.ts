// Dev fallback only. In real deployments set JWT_SECRET as an environment variable.
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const JWT_EXPIRES_IN = '1h';
