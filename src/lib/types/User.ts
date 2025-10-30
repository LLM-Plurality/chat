import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Timestamps";

export type AuthProvider = "huggingface" | "password" | "oidc";

export interface User extends Timestamps {
	_id: ObjectId;

	username?: string;
	name: string;
	email?: string;
	avatarUrl: string | undefined;

	// Auth provider identification
	authProvider: AuthProvider;
	authId: string; // Provider-specific user ID (e.g., hfUserId for HF, username for password)

	// Legacy field for backward compatibility (maps to authId when authProvider is "huggingface")
	hfUserId?: string;

	isAdmin?: boolean;
	isEarlyAccess?: boolean;
}
