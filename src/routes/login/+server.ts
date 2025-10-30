import { getOIDCAuthorizationUrl } from "$lib/server/auth";
import { buildRedirectURI } from "$lib/server/authHelpers";

export async function GET({ request, url, locals }) {
	const redirectURI = buildRedirectURI(request, url);

	// TODO: Handle errors if provider is not responding

	const authorizationUrl = await getOIDCAuthorizationUrl(
		{ redirectURI },
		{ sessionId: locals.sessionId }
	);

	return new Response(null, {
		status: 302,
		headers: {
			Location: authorizationUrl,
		},
	});
}
