import { writable } from "svelte/store";

// Map of conversation ID -> boolean (true = visible)
const initialVisibility: Record<string, boolean> = {};

function createTreeVisibilityStore() {
	const { subscribe, update, set } = writable<Record<string, boolean>>(initialVisibility);

	return {
		subscribe,
		toggle: (id: string) => update((n) => ({ ...n, [id]: !n[id] })),
		setVisible: (id: string, visible: boolean) => update((n) => ({ ...n, [id]: visible })),
		reset: () => set({}),
	};
}

export const treeVisibility = createTreeVisibilityStore();
