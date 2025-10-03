import { collections } from "$lib/server/database";
import { z } from "zod";
import { authCondition } from "$lib/server/auth";
import { DEFAULT_SETTINGS, type SettingsEditable } from "$lib/types/Settings";

const personaSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(100),
	occupation: z.string().max(200).default(""),
	stance: z.string().max(200).default(""),
	prompt: z.string().max(10000).default(""),
	isDefault: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export async function POST({ request, locals }) {
	const body = await request.json();

	const { welcomeModalSeen, ...settings } = z
		.object({
			shareConversationsWithModelAuthors: z
				.boolean()
				.default(DEFAULT_SETTINGS.shareConversationsWithModelAuthors),
			welcomeModalSeen: z.boolean().optional(),
			activeModel: z.string().default(DEFAULT_SETTINGS.activeModel),
			activePersona: z.string().default(DEFAULT_SETTINGS.activePersona),
			personas: z.array(personaSchema).min(1).default(DEFAULT_SETTINGS.personas),
			multimodalOverrides: z.record(z.boolean()).default({}),
			disableStream: z.boolean().default(false),
			directPaste: z.boolean().default(false),
			hidePromptExamples: z.record(z.boolean()).default({}),
		})
		.parse(body) satisfies SettingsEditable;

	await collections.settings.updateOne(
		authCondition(locals),
		{
			$set: {
				...settings,
				...(welcomeModalSeen && { welcomeModalSeenAt: new Date() }),
				updatedAt: new Date(),
			},
			$setOnInsert: {
				createdAt: new Date(),
			},
		},
		{
			upsert: true,
		}
	);
	// return ok response
	return new Response();
}
