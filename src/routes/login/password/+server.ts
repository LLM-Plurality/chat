import { json } from "@sveltejs/kit";
import { z } from "zod";
import { updateUserSession } from "../callback/userSession";
import { collections } from "$lib/server/database";
import { verifyPassword } from "$lib/server/passwords";

function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST({ request, locals, cookies, getClientAddress }) {
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

	// Find user by username or email
	const user = await collections.users.findOne({
		$or: [
			{ username: { $regex: new RegExp(`^${escapeRegExp(identifier)}$`, "i") } },
			{ email: { $regex: new RegExp(`^${escapeRegExp(identifier)}$`, "i") } },
		],
	});

	if (!user || !user.passwordHash) {
		return json({ message: "Invalid username or password" }, { status: 401 });
	}

	let isValid = false;
	try {
		isValid = await verifyPassword(password, user.passwordHash);
	} catch (e) {
		console.error("Error verifying password:", e);
		return json({ message: "Invalid username or password" }, { status: 401 });
	}

	if (!isValid) {
		return json({ message: "Invalid username or password" }, { status: 401 });
	}

	await updateUserSession({
		userData: {
			authProvider: "password",
			authId: user.username || user.email || identifier, // Use username as authId if available
			username: user.username,
			name: user.name,
			email: user.email,
			avatarUrl: user.avatarUrl,
			isAdmin: user.isAdmin,
			isEarlyAccess: user.isEarlyAccess,
		},
		locals,
		cookies,
		userAgent: request.headers.get("user-agent") ?? undefined,
		ip: getClientAddress(),
	});

	return json({ message: "Success" });
}
