<script lang="ts">
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";
	import { useSettingsStore } from "$lib/stores/settings";
	import CarbonUser from "~icons/carbon/user";

	const settings = useSettingsStore();

	let activePersona = $derived(
		$settings.personas.find((p) => p.id === $settings.activePersona) ?? $settings.personas[0]
	);
</script>

<button
	class="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm text-gray-700 shadow-sm hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
	onclick={() => goto(`${base}/settings/personas`)}
	title="Manage personas"
>
	<CarbonUser class="text-xs" />
	<span class="max-w-[150px] truncate">{activePersona?.name ?? "Default"}</span>
</button>

