import { json } from "@sveltejs/kit";
import { z } from "zod";
import { collections } from "$lib/server/database";
import { hashPassword, generateRecoveryKey } from "$lib/server/passwords";
import { updateUserSession } from "../callback/userSession";

function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST({ request, locals, cookies, getClientAddress }) {
	const body = await request.json();

	const { username, password, email } = z
		.object({
			username: z.string().min(1).trim(),
			password: z.string().min(8),
			email: z
				.union([z.string().email(), z.literal("")])
				.optional()
				.transform((e) => (e === "" ? undefined : e)),
		})
		.parse(body);

	// Check if user already exists
	const existingUser = await collections.users.findOne({
		$or: [
			{ username: { $regex: new RegExp(`^${escapeRegExp(username)}$`, "i") } },
			...(email ? [{ email: { $regex: new RegExp(`^${escapeRegExp(email)}$`, "i") } }] : []),
		],
	});

	if (existingUser) {
		return json({ message: "User already exists" }, { status: 409 });
	}

	const recoveryKey = generateRecoveryKey();
	const passwordHash = await hashPassword(password);
	const recoveryKeyHash = await hashPassword(recoveryKey); // Hash recovery key same way as password

	await updateUserSession({
		userData: {
			authProvider: "password",
			authId: username,
			username,
			name: username,
			email,
			passwordHash,
			recoveryKeyHash,
		},
		locals,
		cookies,
		userAgent: request.headers.get("user-agent") ?? undefined,
		ip: getClientAddress(),
	});

	return json({ recoveryKey });
}
