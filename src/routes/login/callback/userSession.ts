import { getCoupledCookieHash, refreshSessionCookie } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";
import { DEFAULT_SETTINGS } from "$lib/types/Settings";
import { error, type Cookies } from "@sveltejs/kit";
import crypto from "crypto";
import { sha256 } from "$lib/utils/sha256";
import { addWeeks } from "date-fns";
import { logger } from "$lib/server/logger";
import type { AuthProvider } from "$lib/types/User";
import { encryptToken } from "$lib/server/tokenEncryption";

export interface UserUpdateData {
	authProvider: AuthProvider;
	authId: string;
	username?: string;
	name: string;
	email?: string;
	avatarUrl?: string;
	isAdmin?: boolean;
	isEarlyAccess?: boolean;
}

export async function updateUserSession(params: {
	userData: UserUpdateData;
	locals: App.Locals;
	cookies: Cookies;
	userAgent?: string;
	ip?: string;
	hfAccessToken?: string;
}) {
	const { userData, locals, cookies, userAgent, ip, hfAccessToken } = params;

	logger.info(
		{
			authProvider: userData.authProvider,
			authId: userData.authId,
			login_username: userData.username,
			login_name: userData.name,
			login_email: userData.email,
		},
		"user login"
	);

	logger.debug(
		{
			isAdmin: userData.isAdmin,
			isEarlyAccess: userData.isEarlyAccess,
			authId: userData.authId,
		},
		`Updating user ${userData.authId}`
	);

	// check if user already exists (by authProvider + authId, or legacy hfUserId for HF)
	const existingUser =
		userData.authProvider === "huggingface"
			? await collections.users.findOne({
					$or: [
						{ authProvider: "huggingface", authId: userData.authId },
						{ hfUserId: userData.authId }, // Legacy lookup
					],
				})
			: await collections.users.findOne({
					authProvider: userData.authProvider,
					authId: userData.authId,
				});

	let userId = existingUser?._id;

	// update session cookie on login
	const previousSessionId = locals.sessionId;
	const secretSessionId = crypto.randomUUID();
	const sessionId = await sha256(secretSessionId);

	if (await collections.sessions.findOne({ sessionId })) {
		error(500, "Session ID collision");
	}

	locals.sessionId = sessionId;

	// Get cookie hash if coupling is enabled
	const coupledCookieHash = await getCoupledCookieHash({ type: "svelte", value: cookies });

	const userUpdateData = {
		username: userData.username,
		name: userData.name,
		avatarUrl: userData.avatarUrl,
		isAdmin: userData.isAdmin,
		isEarlyAccess: userData.isEarlyAccess,
		...(userData.authProvider === "huggingface" ? { hfUserId: userData.authId } : {}),
	};

	if (existingUser) {
		// Update existing user
		await collections.users.updateOne(
			{ _id: existingUser._id },
			{
				$set: {
					...userUpdateData,
					authProvider: userData.authProvider,
					authId: userData.authId,
					email: userData.email,
					updatedAt: new Date(),
				},
			}
		);

		// remove previous session if it exists and add new one
		await collections.sessions.deleteOne({ sessionId: previousSessionId });
		await collections.sessions.insertOne({
			_id: new ObjectId(),
			sessionId: locals.sessionId,
			userId: existingUser._id,
			createdAt: new Date(),
			updatedAt: new Date(),
			userAgent,
			ip,
			expiresAt: addWeeks(new Date(), 2),
			...(coupledCookieHash ? { coupledCookieHash } : {}),
		});
	} else {
		// user doesn't exist yet, create a new one
		const { insertedId } = await collections.users.insertOne({
			_id: new ObjectId(),
			createdAt: new Date(),
			updatedAt: new Date(),
			username: userUpdateData.username,
			name: userUpdateData.name,
			avatarUrl: userUpdateData.avatarUrl,
			isAdmin: userUpdateData.isAdmin,
			isEarlyAccess: userUpdateData.isEarlyAccess,
			authProvider: userData.authProvider,
			authId: userData.authId,
			email: userData.email,
			...(userData.authProvider === "huggingface" ? { hfUserId: userData.authId } : {}),
		});

		userId = insertedId;

		await collections.sessions.insertOne({
			_id: new ObjectId(),
			sessionId: locals.sessionId,
			userId,
			createdAt: new Date(),
			updatedAt: new Date(),
			userAgent,
			ip,
			expiresAt: addWeeks(new Date(), 2),
			...(coupledCookieHash ? { coupledCookieHash } : {}),
		});

		// move pre-existing settings to new user
		const { matchedCount } = await collections.settings.updateOne(
			{ sessionId: previousSessionId },
			{
				$set: { userId, updatedAt: new Date() },
				$unset: { sessionId: "" },
			}
		);

		if (!matchedCount) {
			// if no settings found for user, create default settings
			await collections.settings.insertOne({
				userId,
				updatedAt: new Date(),
				createdAt: new Date(),
				...DEFAULT_SETTINGS,
			});
		}
	}

	// refresh session cookie
	refreshSessionCookie(cookies, secretSessionId);

	// migrate pre-existing conversations
	await collections.conversations.updateMany(
		{ sessionId: previousSessionId },
		{
			$set: { userId },
			$unset: { sessionId: "" },
		}
	);

	// Manage stored Hugging Face tokens based on auth provider
	if (userData.authProvider === "huggingface" && hfAccessToken) {
		const encryptedToken = encryptToken(hfAccessToken);
		await collections.userTokens.updateOne(
			{ userId, provider: "huggingface" },
			{
				$set: {
					encryptedToken,
					updatedAt: new Date(),
				},
				$setOnInsert: {
					_id: new ObjectId(),
					userId,
					provider: "huggingface",
					createdAt: new Date(),
				},
			},
			{ upsert: true }
		);
	} else {
		await collections.userTokens.deleteOne({ userId, provider: "huggingface" });
	}

	return { userId };
}
