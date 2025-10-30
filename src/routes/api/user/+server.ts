import { getUserHFToken } from "$lib/server/userTokens";

export async function GET({ locals }) {
	if (locals.user) {
		const hasHFToken = locals.user._id ? (await getUserHFToken(locals.user._id)) !== null : false;

		const res = {
			id: locals.user._id,
			username: locals.user.username,
			name: locals.user.name,
			email: locals.user.email,
			avatarUrl: locals.user.avatarUrl,
			hfUserId: locals.user.hfUserId,
			authProvider: locals.user.authProvider,
			hasHFToken,
		};

		return Response.json(res);
	}
	return Response.json({ message: "Must be signed in" }, { status: 401 });
}
