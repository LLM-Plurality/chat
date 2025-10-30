import crypto from "crypto";
import { config } from "./config";
import { logger } from "./logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Gets the encryption key from config or generates a warning
 */
function getEncryptionKey(): Buffer {
	const key = config.HF_TOKEN_ENCRYPTION_KEY;
	if (!key) {
		logger.warn(
			"HF_TOKEN_ENCRYPTION_KEY not set. Tokens will be stored unencrypted. Set this to a 32-byte hex string for production."
		);
		// For development, use a default key (not secure, but allows testing)
		const defaultKey = crypto.randomBytes(KEY_LENGTH).toString("hex");
		logger.warn(`Using temporary encryption key: ${defaultKey}`);
		return Buffer.from(defaultKey.slice(0, KEY_LENGTH * 2), "hex");
	}

	if (key.length !== KEY_LENGTH * 2) {
		throw new Error(`HF_TOKEN_ENCRYPTION_KEY must be exactly ${KEY_LENGTH * 2} characters`);
	}

	return Buffer.from(key, "hex");
}

/**
 * Encrypts a token using AES-256-GCM with a random IV
 */
export function encryptToken(token: string): string {
	const key = getEncryptionKey();
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(token, "utf8", "hex");
	encrypted += cipher.final("hex");

	const authTag = cipher.getAuthTag();

	// Combine IV + authTag + encrypted data
	return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

/**
 * Decrypts a token that was encrypted with encryptToken
 */
export function decryptToken(encryptedToken: string): string {
	const key = getEncryptionKey();
	const parts = encryptedToken.split(":");

	if (parts.length !== 3) {
		throw new Error("Invalid encrypted token format");
	}

	const iv = Buffer.from(parts[0], "hex");
	const authTag = Buffer.from(parts[1], "hex");
	const encrypted = parts[2];

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	let decrypted = decipher.update(encrypted, "hex", "utf8");
	decrypted += decipher.final("utf8");

	return decrypted;
}
