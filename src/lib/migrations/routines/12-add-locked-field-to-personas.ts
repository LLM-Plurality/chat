import type { Migration } from ".";
import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";

const migration: Migration = {
	_id: new ObjectId("000000000000000000000012"),
	name: "Add locked field to personas",
	up: async () => {
		const { settings } = collections;

		// Add locked: true to all default personas
		// Default personas are identified by isDefault: true
		await settings.updateMany(
			{ "personas.isDefault": true },
			{
				$set: {
					"personas.$[elem].locked": true,
					updatedAt: new Date(),
				},
			},
			{
				arrayFilters: [{ "elem.isDefault": true }],
			}
		);

		// Add archived: false by default
		await settings.updateMany(
			{ "personas.archived": { $exists: false } },
			{
				$set: {
					"personas.$[elem].archived": false,
					updatedAt: new Date(),
				},
			},
			{
				arrayFilters: [{ "elem.archived": { $exists: false } }],
			}
		);

		return true;
	},
};

export default migration;
