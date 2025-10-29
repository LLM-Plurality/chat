import { collections } from "$lib/server/database";
import { authCondition } from "$lib/server/auth";
import { z } from "zod";

export async function GET({ locals, params }) {
	if (!locals.user && !locals.sessionId) {
		return Response.json({ message: "Unauthorized" }, { status: 401 });
	}

	const personaId = z.string().min(1).parse(params.personaId);
	const condition = authCondition(locals);

	const settings = await collections.settings.findOne(
		{ ...condition, "personas.id": personaId },
		{ projection: { _id: 1 } }
	);

	if (!settings) {
		return Response.json({ message: "Persona not found" }, { status: 404 });
	}

	const personaUsed = await collections.conversations.findOne(
		{
			...condition,
			$or: [
				{ personaId },
				{ branchedFromPersonaId: personaId },
				{ lockedPersonaId: personaId },
				{ "messages.personaResponses.personaId": personaId },
				{ "messages.personaResponses.children.personaId": personaId },
			],
		},
		{ projection: { _id: 1 } }
	);

	return Response.json({ used: Boolean(personaUsed) });
}
