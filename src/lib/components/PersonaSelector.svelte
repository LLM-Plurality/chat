<script lang="ts">
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";
	import { useSettingsStore } from "$lib/stores/settings";
	import CarbonUser from "~icons/carbon/user";
	import CarbonSwitcher from "~icons/carbon/switcher";
	import CarbonLocked from "~icons/carbon/locked";

	interface Props {
		lockedPersonaId?: string;
	}

	let { lockedPersonaId }: Props = $props();

	const settings = useSettingsStore();

	const availablePersonas = $derived($settings.personas.filter((persona) => !persona.archived));

	// If locked, show only the locked persona; otherwise show active personas
	let activePersonas = $derived(
		lockedPersonaId
			? availablePersonas.filter((persona) => persona.id === lockedPersonaId)
			: $settings.activePersonas
				.map((id) => availablePersonas.find((persona) => persona.id === id))
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
		if (activePersonas.length > 1 && !lockedPersonaId) {
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
		class="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm text-gray-400 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500 {lockedPersonaId ? 'cursor-not-allowed opacity-75' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}"
		onclick={() => {
			if (!lockedPersonaId) {
			const firstActive = $settings.activePersonas.find((id) =>
				availablePersonas.some((persona) => persona.id === id)
			);
			const fallback = availablePersonas[0]?.id ?? "";
			goto(`${base}/settings/personas/${firstActive ?? fallback}`);
			}
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		title={lockedPersonaId ? "Persona locked in branch" : (activePersonas.length === 1 ? 'Manage personas' : '')}
	>
		{#if lockedPersonaId}
			<CarbonLocked class="text-xs" />
		{:else}
			<CarbonUser class="text-xs" />
		{/if}
		<span class="max-w-[150px] truncate">{displayText()}</span>
	</button>

	{#if showDropdown && activePersonas.length > 1}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			role="menu"
			tabindex="-1"
			class="absolute bottom-full left-0 mb-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-lg border border-gray-300 bg-gray-100 py-1.5 shadow-lg dark:border-gray-600 dark:bg-gray-800"
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		>
			<div class="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500">
				Active Personas
			</div>
			{#each activePersonas as persona (persona?.id)}
				<button
					type="button"
					class="group flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-gray-400 transition-all duration-200 hover:bg-gray-200 hover:pl-4 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
					onclick={() => goto(`${base}/settings/personas/${persona?.id || ''}`)}
				>
					<div class="flex items-center gap-2 truncate">
						<div class="size-1.5 flex-shrink-0 rounded-full bg-gray-400 dark:bg-gray-500"></div>
						<span class="truncate">{persona?.name ?? "Unknown"}</span>
					</div>
					<CarbonSwitcher class="size-3.5 flex-shrink-0 text-gray-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-gray-500" />
				</button>
			{/each}
		</div>
	{/if}
</div>

