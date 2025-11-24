import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

/**
 * Hashes a password using scrypt with a random salt.
 * Returns the salt and hash combined as a string.
 */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString("hex");
	const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
	return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a password against a stored hash (salt:hash).
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const [salt, key] = storedHash.split(":");
	if (!salt || !key) return false;

	const keyBuffer = Buffer.from(key, "hex");
	const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
	return timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Generates a secure random recovery key.
 */
export function generateRecoveryKey(): string {
	return `rk-${randomBytes(24).toString("hex")}`;
}
