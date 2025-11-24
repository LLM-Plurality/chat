import { json } from "@sveltejs/kit";
import { z } from "zod";
import { collections } from "$lib/server/database";
import { verifyPassword, hashPassword, generateRecoveryKey } from "$lib/server/passwords";

function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST({ request }) {
	const body = await request.json();
	const { username, recoveryKey, newPassword } = z
		.object({
			username: z.string().min(1).trim(),
			recoveryKey: z.string().min(1),
			newPassword: z.string().min(8),
		})
		.parse(body);

	const user = await collections.users.findOne({
		username: { $regex: new RegExp(`^${escapeRegExp(username)}$`, "i") },
	});

	if (!user || !user.recoveryKeyHash) {
		return json({ message: "Invalid username or recovery key" }, { status: 401 });
	}

	let isValid = false;
	try {
		isValid = await verifyPassword(recoveryKey, user.recoveryKeyHash);
	} catch (e) {
		console.error("Error verifying recovery key:", e);
		return json({ message: "Invalid username or recovery key" }, { status: 401 });
	}

	if (!isValid) {
		return json({ message: "Invalid username or recovery key" }, { status: 401 });
	}

	const passwordHash = await hashPassword(newPassword);

	// Rotate the recovery key after successful use
	const newRecoveryKey = generateRecoveryKey();
	const newRecoveryKeyHash = await hashPassword(newRecoveryKey);

	await collections.users.updateOne(
		{ _id: user._id },
		{ $set: { passwordHash, recoveryKeyHash: newRecoveryKeyHash, updatedAt: new Date() } }
	);

	return json({
		message: "Password updated successfully. A new recovery key has been generated.",
		newRecoveryKey,
	});
}
