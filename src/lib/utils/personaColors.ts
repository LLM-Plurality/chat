/**
 * Generate a consistent color for a persona based on their ID
 * Uses a rainbow spectrum for variety
 */
export function getPersonaColor(personaId: string): string {
	// Simple hash function to get a number from persona ID
	let hash = 0;
	for (let i = 0; i < personaId.length; i++) {
		hash = personaId.charCodeAt(i) + ((hash << 5) - hash);
		hash = hash & hash; // Convert to 32bit integer
	}

	// Use hash to pick from a set of distinct colors
	const colors = [
		"#ef4444", // red
		"#f97316", // orange
		"#f59e0b", // amber
		"#eab308", // yellow
		"#84cc16", // lime
		"#22c55e", // green
		"#10b981", // emerald
		"#14b8a6", // teal
		"#06b6d4", // cyan
		"#0ea5e9", // sky
		"#3b82f6", // blue
		"#6366f1", // indigo
		"#8b5cf6", // violet
		"#a855f7", // purple
		"#d946ef", // fuchsia
		"#ec4899", // pink
		"#f43f5e", // rose
	];

	const index = Math.abs(hash) % colors.length;
	return colors[index];
}

/**
 * User message color
 */
export const USER_COLOR = "#9ca3af"; // gray-400
