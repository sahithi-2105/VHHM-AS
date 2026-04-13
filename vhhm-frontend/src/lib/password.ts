import crypto from 'crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashed = crypto.createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hashed}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hashed] = stored.split(':');
    if (!salt || !hashed) {
      // Legacy plain-text fallback (for existing accounts)
      return password === stored;
    }
    return crypto.createHash('sha256').update(salt + password).digest('hex') === hashed;
  } catch {
    // Legacy plain-text fallback
    return password === stored;
  }
}
