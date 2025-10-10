<script lang="ts">
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";
	import { useSettingsStore } from "$lib/stores/settings";
	import CarbonUser from "~icons/carbon/user";
	import CarbonEdit from "~icons/carbon/edit";

	const settings = useSettingsStore();

	let activePersonas = $derived(
		$settings.activePersonas
			.map(id => $settings.personas.find((p) => p.id === id))
			.filter(Boolean)
	);
	
	let displayText = $derived(() => {
		if (activePersonas.length === 0) return "No active personas";
		if (activePersonas.length === 1) return activePersonas[0]?.name ?? "Default";
		return `${activePersonas.length} personas`;
	});

	let showDropdown = $state(false);
	let hideTimeout: number | undefined = $state();

	function handleMouseEnter() {
		if (hideTimeout) {
			clearTimeout(hideTimeout);
			hideTimeout = undefined;
		}
		if (activePersonas.length > 1) {
			showDropdown = true;
		}
	}

	function handleMouseLeave() {
		hideTimeout = window.setTimeout(() => {
			showDropdown = false;
		}, 100);
	}
</script>

<div class="relative">
	<button
		class="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm text-gray-400 shadow-sm hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700"
		onclick={() => goto(`${base}/settings/personas/${$settings.activePersonas[0] || $settings.personas[0]?.id || ''}`)}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		title="{activePersonas.length === 1 ? 'Manage personas' : ''}"
	>
		<CarbonUser class="text-xs" />
		<span class="max-w-[150px] truncate">{displayText()}</span>
	</button>

	{#if showDropdown && activePersonas.length > 1}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			role="menu"
			tabindex="-1"
			class="absolute bottom-full left-0 mb-1 min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-lg border border-gray-300 bg-white py-1.5 shadow-lg dark:border-gray-600 dark:bg-gray-800"
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		>
			<div class="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
				Active Personas
			</div>
			{#each activePersonas as persona (persona?.id)}
				<button
					type="button"
					class="group flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-gray-700 transition-all duration-200 hover:bg-gray-100 hover:pl-4 dark:text-gray-300 dark:hover:bg-gray-700"
					onclick={() => goto(`${base}/settings/personas/${persona?.id || ''}`)}
				>
					<div class="flex items-center gap-2 truncate">
						<div class="size-1.5 flex-shrink-0 rounded-full bg-black dark:bg-white"></div>
						<span class="truncate">{persona?.name ?? "Unknown"}</span>
					</div>
					<CarbonEdit class="size-3.5 flex-shrink-0 text-gray-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-gray-500" />
				</button>
			{/each}
		</div>
	{/if}
</div>

