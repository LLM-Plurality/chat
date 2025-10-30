import { z } from "zod";
import type { UserinfoResponse } from "openid-client";
import { OIDConfig } from "$lib/server/auth";
import { config } from "$lib/server/config";
import { updateUserSession } from "./userSession";
import type { Cookies } from "@sveltejs/kit";

import type { AuthProvider } from "$lib/types/User";

export async function updateUser(params: {
	userData: UserinfoResponse;
	locals: App.Locals;
	cookies: Cookies;
	userAgent?: string;
	ip?: string;
	authProvider: AuthProvider;
	accessToken?: string;
}) {
	const { userData, locals, cookies, userAgent, ip, authProvider, accessToken } = params;

	// Microsoft Entra v1 tokens do not provide preferred_username, instead the username is provided in the upn
	// claim. See https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference
	if (!userData.preferred_username && userData.upn) {
		userData.preferred_username = userData.upn as string;
	}

	const {
		preferred_username: username,
		name,
		email,
		picture: avatarUrl,
		sub: hfUserId,
		orgs,
	} = z
		.object({
			preferred_username: z.string().optional(),
			name: z.string(),
			picture: z.string().optional(),
			sub: z.string(),
			email: z.string().email().optional(),
			orgs: z
				.array(
					z.object({
						sub: z.string(),
						name: z.string(),
						picture: z.string(),
						preferred_username: z.string(),
						isEnterprise: z.boolean(),
					})
				)
				.optional(),
		})
		.setKey(OIDConfig.NAME_CLAIM, z.string())
		.refine((data) => data.preferred_username || data.email, {
			message: "Either preferred_username or email must be provided by the provider.",
		})
		.transform((data) => ({
			...data,
			name: data[OIDConfig.NAME_CLAIM],
		}))
		.parse(userData) as {
		preferred_username?: string;
		email?: string;
		picture?: string;
		sub: string;
		name: string;
		orgs?: Array<{
			sub: string;
			name: string;
			picture: string;
			preferred_username: string;
			isEnterprise: boolean;
		}>;
	} & Record<string, string>;

	const isHuggingFace = authProvider === "huggingface";
	// if using huggingface as auth provider, check orgs for early access and admin rights
	const isAdmin =
		isHuggingFace && config.HF_ORG_ADMIN
			? orgs?.some((org) => org.sub === config.HF_ORG_ADMIN) || false
			: false;
	const isEarlyAccess =
		isHuggingFace && config.HF_ORG_EARLY_ACCESS
			? orgs?.some((org) => org.sub === config.HF_ORG_EARLY_ACCESS) || false
			: false;

	return await updateUserSession({
		userData: {
			authProvider,
			authId: hfUserId,
			username,
			name,
			email,
			avatarUrl,
			isAdmin,
			isEarlyAccess,
		},
		locals,
		cookies,
		userAgent,
		ip,
		hfAccessToken: isHuggingFace ? accessToken : undefined,
	});
}
