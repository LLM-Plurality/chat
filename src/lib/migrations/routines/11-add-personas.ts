import type { Migration } from ".";
import { collections } from "$lib/server/database";
import { DEFAULT_PERSONAS } from "$lib/server/defaultPersonas";
import { ObjectId } from "mongodb";

const migration: Migration = {
	_id: new ObjectId("000000000000000000000011"),
	name: "Add personas to settings",
	up: async () => {
		const { settings } = collections;

		// Add personas array and activePersona to all existing settings
		await settings.updateMany(
			{},
			{
				$set: {
					activePersona: "default",
					personas: DEFAULT_PERSONAS.map((p) => ({
						...p,
						createdAt: new Date(),
						updatedAt: new Date(),
					})),
					updatedAt: new Date(),
				},
				// Remove customPrompts field
				$unset: {
					customPrompts: "",
				},
			}
		);

		return true;
	},
};

export default migration;
