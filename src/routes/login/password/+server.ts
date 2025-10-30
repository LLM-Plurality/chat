import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { config } from "$lib/server/config";
import { updateUserSession } from "../callback/userSession";
import { sha256 } from "$lib/utils/sha256";
import JSON5 from "json5";

const sanitizeJSONEnv = (val: string, fallback: string) => {
	const raw = (val ?? "").trim();
	const unquoted = raw.startsWith("`") && raw.endsWith("`") ? raw.slice(1, -1) : raw;
	return unquoted || fallback;
};

const parseJSONEnv = (val: string, fallback: string) => {
	try {
		return JSON5.parse(sanitizeJSONEnv(val, fallback));
	} catch (e) {
		console.warn(`Failed to parse environment variable as JSON5, using fallback: ${fallback}`, e);
		return JSON5.parse(fallback);
	}
};

interface PasswordCredential {
	username?: string;
	email?: string;
	passwordHash: string; // SHA256 hash
	name?: string;
	isAdmin?: boolean;
	isEarlyAccess?: boolean;
}

const passwordWhitelist = z
	.array(
		z
			.object({
				username: z.string().optional(),
				email: z.string().email().optional(),
				passwordHash: z.string().length(64),
				name: z.string().optional(),
				isAdmin: z.boolean().optional(),
				isEarlyAccess: z.boolean().optional(),
			})
			.refine((cred) => (cred.username && cred.username.length > 0) || !!cred.email, {
				message: "Either a non-empty username or an email must be provided",
				path: ["username"],
			})
	)
	.optional()
	.default([])
	.parse(parseJSONEnv(config.PASSWORD_LOGIN_WHITELIST || "[]", "[]")) as PasswordCredential[];

export async function POST({ request, locals, cookies, getClientAddress }) {
	if (!passwordWhitelist.length) {
		throw error(403, "Password login is not configured");
	}

	let body: Record<string, unknown> = {};
	const contentType = request.headers.get("content-type") ?? "";

	if (contentType.includes("application/json")) {
		body = await request.json();
	} else {
		const formData = await request.formData();
		body = Object.fromEntries(formData.entries());
	}

	const { username, password } = z
		.object({
			username: z.string().min(1),
			password: z.string().min(1),
		})
		.parse(body);

	const identifier = username.trim();
	const passwordHash = await sha256(password);
	const credential = passwordWhitelist.find((cred) => {
		if (cred.passwordHash !== passwordHash) {
			return false;
		}
		const matchesUsername = cred.username
			? cred.username.toLowerCase() === identifier.toLowerCase()
			: false;
		const matchesEmail = cred.email ? cred.email.toLowerCase() === identifier.toLowerCase() : false;
		return matchesUsername || matchesEmail;
	});

	if (!credential) {
		return json({ message: "Invalid username or password" }, { status: 401 });
	}

	const authId = (credential.username ?? credential.email ?? identifier).toLowerCase();
	const displayName = credential.name || credential.username || credential.email || identifier;

	await updateUserSession({
		userData: {
			authProvider: "password",
			authId,
			username: credential.username ?? credential.email ?? identifier,
			name: displayName,
			email: credential.email,
			avatarUrl: undefined,
			isAdmin: credential.isAdmin || false,
			isEarlyAccess: credential.isEarlyAccess || false,
		},
		locals,
		cookies,
		userAgent: request.headers.get("user-agent") ?? undefined,
		ip: getClientAddress(),
	});

	return json({ message: "Success" });
}
