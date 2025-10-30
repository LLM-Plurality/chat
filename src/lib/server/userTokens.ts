import { collections } from "./database";
import { decryptToken } from "./tokenEncryption";
import type { ObjectId } from "mongodb";

/**
 * Retrieves and decrypts a user's Hugging Face token if available
 */
export async function getUserHFToken(userId: ObjectId): Promise<string | null> {
	const userToken = await collections.userTokens.findOne({
		userId,
		provider: "huggingface",
	});

	if (!userToken) {
		return null;
	}

	try {
		return decryptToken(userToken.encryptedToken);
	} catch (error) {
		console.error("Failed to decrypt user token:", error);
		return null;
	}
}
