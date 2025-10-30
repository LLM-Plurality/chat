import { base } from "$app/paths";
import { config } from "$lib/server/config";
import { generateCsrfToken } from "./auth";
import type { RequestEvent } from "@sveltejs/kit";

// Build a redirect URI for OAuth callbacks
export function buildRedirectURI(request: RequestEvent["request"], url: URL): string {
	const referer = request.headers.get("referer");
	let redirectURI = `${(referer ? new URL(referer) : url).origin}${base}/login/callback`;

	if (url.searchParams.has("callback")) {
		const callback = url.searchParams.get("callback") || redirectURI;
		if (config.ALTERNATIVE_REDIRECT_URLS.includes(callback)) {
			redirectURI = callback;
		}
	}

	return redirectURI;
}

// Generate a CSRF token wrapped in base64 for OAuth state parameter
export async function createOAuthState(sessionId: string, redirectURI: string): Promise<string> {
	return await generateCsrfToken(sessionId, redirectURI);
}
