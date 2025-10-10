<script lang="ts">
	import { onMount, tick } from "svelte";
	import { base } from "$app/paths";
	import { afterNavigate, goto } from "$app/navigation";
	import { page } from "$app/state";
	import { useSettingsStore } from "$lib/stores/settings";
	import IconOmni from "$lib/components/icons/IconOmni.svelte";
	import CarbonClose from "~icons/carbon/close";
	import CarbonChevronLeft from "~icons/carbon/chevron-left";
	import CarbonView from "~icons/carbon/view";

	import type { LayoutData } from "../$types";
	import { browser } from "$app/environment";
	import { isDesktop } from "$lib/utils/isDesktop";
	import { debounce } from "$lib/utils/debounce";
	import type { Persona } from "$lib/types/Persona";
	import { v4 } from "uuid";

	interface Props {
		data: LayoutData;
		children?: import("svelte").Snippet;
	}

	let { data, children }: Props = $props();

	let previousPage: string = $state(base || "/");
	let showContent: boolean = $state(false);

	let navContainer: HTMLDivElement | undefined = $state();

	async function scrollSelectedItemIntoView() {
		await tick();
		const container = navContainer;
		if (!container) return;
		
		if (activeTab === 'models') {
			const currentModelId = page.params.model as string | undefined;
			if (!currentModelId) return;
			const buttons = container.querySelectorAll<HTMLButtonElement>("button[data-model-id]");
			for (const btn of buttons) {
				if (btn.dataset.modelId === currentModelId) {
					btn.scrollIntoView({ block: "nearest", inline: "nearest" });
					break;
				}
			}
		} else if (activeTab === 'personas') {
			const currentPersonaId = page.params.persona as string | undefined;
			if (!currentPersonaId) return;
			const buttons = container.querySelectorAll<HTMLButtonElement>("button[data-persona-id]");
			for (const btn of buttons) {
				if (btn.dataset.personaId === currentPersonaId) {
					btn.scrollIntoView({ block: "nearest", inline: "nearest" });
					break;
				}
			}
		}
	}

	function checkDesktopRedirect() {
		if (
			browser &&
			isDesktop(window) &&
			page.url.pathname === `${base}/settings`
		) {
			goto(`${base}/settings/application`);
		}
	}

	// Helper to determine if we should show content or list
	function shouldShowContent(pathname: string): boolean {
		// Hide content (show list only) for root settings, models list, and personas list
		if (
			pathname === `${base}/settings` ||
			pathname === `${base}/settings/models` ||
			pathname === `${base}/settings/personas`
		) {
			return false;
		}
		// Show content for everything else (specific model/persona/application)
		return true;
	}

	onMount(() => {
		// Show content based on current path
		showContent = shouldShowContent(page.url.pathname);
		// Initial desktop redirect check
		checkDesktopRedirect();

		// Ensure the selected item is visible in the nav
		void scrollSelectedItemIntoView();

		// Add resize listener for desktop redirect
		if (browser) {
			const debouncedCheck = debounce(checkDesktopRedirect, 100);
			window.addEventListener("resize", debouncedCheck);
			return () => window.removeEventListener("resize", debouncedCheck);
		}
	});

	afterNavigate(({ from }) => {
		if (from?.url && !from.url.pathname.includes("settings")) {
			previousPage = from.url.toString() || previousPage || base || "/";
		}
		// Show content based on current path
		showContent = shouldShowContent(page.url.pathname);
		// Check desktop redirect after navigation
		checkDesktopRedirect();
		// After navigation, keep the selected item in view
		void scrollSelectedItemIntoView();
	});

	const settings = useSettingsStore();

	// Local filter for model list (hyphen/space insensitive)
	let modelFilter = $state("");
	const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ");
	let queryTokens = $derived(normalize(modelFilter).trim().split(/\s+/).filter(Boolean));

	// Local filter for persona list
	let personaFilter = $state("");
	let personaQueryTokens = $derived(normalize(personaFilter).trim().split(/\s+/).filter(Boolean));

	// Determine active tab based on current route
	let activeTab = $derived.by(() => {
		if (page.url.pathname.includes("/personas")) return "personas";
		if (page.url.pathname.includes("/application")) return "application";
		if (page.url.pathname.includes("/models")) return "models";
		return "models"; // default
	});

	function createNewPersona() {
		const newPersona: Persona = {
			id: v4(),
			name: "New Persona",
			occupation: "",
			stance: "",
			prompt: "",
			isDefault: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		$settings.personas = [...$settings.personas, newPersona];
		// Navigate to the new persona
		goto(`${base}/settings/personas/${newPersona.id}`);
	}

	function handlePersonaDoubleClick(personaId: string) {
		// Toggle the persona on double-click
		const isActive = $settings.activePersonas.includes(personaId);
		if (isActive) {
			// Prevent deactivating the last active persona
			if ($settings.activePersonas.length === 1) {
				alert("At least one persona must be active.");
				return;
			}
			settings.instantSet({ activePersonas: $settings.activePersonas.filter(id => id !== personaId) });
		} else {
			settings.instantSet({ activePersonas: [...$settings.activePersonas, personaId] });
		}
	}
</script>

<div
	class="mx-auto grid h-full w-full max-w-[1400px] grid-cols-1 grid-rows-[auto,1fr] content-start gap-x-6 overflow-hidden p-4 text-gray-800 dark:text-gray-300 md:grid-cols-3 md:grid-rows-[auto,1fr] md:p-4"
>
	<div class="col-span-1 mb-3 flex flex-col gap-3 md:col-span-3 md:mb-4">
		<div class="flex items-center justify-between">
			{#if browser && !isDesktop(window)}
				{#if showContent && (activeTab === 'models' || activeTab === 'personas')}
					<!-- Detail view: show only back button -->
					<button
						class="btn rounded-lg"
						aria-label="Back to list"
						onclick={() => {
							if (activeTab === 'models') {
								goto(`${base}/settings/models`);
							} else if (activeTab === 'personas') {
								goto(`${base}/settings/personas`);
							}
						}}
					>
						<CarbonChevronLeft
							class="text-xl text-gray-900 hover:text-black dark:text-gray-200 dark:hover:text-white"
						/>
					</button>
				{:else}
					<!-- List view or application: show only X button -->
					<button
						class="btn rounded-lg"
						aria-label="Close settings"
						onclick={() => {
							goto(previousPage);
						}}
					>
						<CarbonClose
							class="text-xl text-gray-900 hover:text-black dark:text-gray-200 dark:hover:text-white"
						/>
					</button>
				{/if}
			{/if}
			<h2 class="left-0 right-0 mx-auto w-fit text-center text-xl font-bold md:hidden">Settings</h2>
			{#if browser && isDesktop(window)}
				<!-- Desktop: always show X button on the right -->
				<button
					class="btn rounded-lg"
					aria-label="Close settings"
					onclick={() => {
						goto(previousPage);
					}}
				>
					<CarbonClose
						class="text-xl text-gray-900 hover:text-black dark:text-gray-200 dark:hover:text-white"
					/>
				</button>
			{:else if showContent && (activeTab === 'models' || activeTab === 'personas')}
				<!-- Mobile detail view: placeholder to maintain layout -->
				<div class="size-8"></div>
			{/if}
		</div>
		
		<!-- Tab Navigation -->
		<div class="flex gap-2 border-b border-gray-200 dark:border-gray-700" class:max-md:hidden={showContent && browser}>
			<button
				class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'models'
					? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
					: 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'}"
				onclick={() => {
					// On mobile list view, go to list; otherwise go to active item detail
					if (browser && !isDesktop(window) && !showContent) {
						goto(`${base}/settings/models`);
					} else {
						goto(`${base}/settings/models/${$settings.activeModel || data.models[0]?.id || ''}`);
					}
				}}
			>
				Models
			</button>
			<button
				class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'personas'
					? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
					: 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'}"
				onclick={() => {
					// On mobile list view, go to list; otherwise go to active item detail
					if (browser && !isDesktop(window) && !showContent) {
						goto(`${base}/settings/personas`);
					} else {
						goto(`${base}/settings/personas/${$settings.activePersonas[0] || $settings.personas[0]?.id || ''}`);
					}
				}}
			>
				Personas
			</button>
			<button
				class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'application'
					? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
					: 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'}"
				onclick={() => goto(`${base}/settings/application`)}
			>
				Settings
			</button>
		</div>
	</div>
	{#if !(showContent && browser && !isDesktop(window)) && activeTab === 'models'}
		<div
			class="scrollbar-custom col-span-1 flex flex-col overflow-y-auto whitespace-nowrap rounded-r-xl bg-gradient-to-l from-gray-50 to-10% dark:from-gray-700/40 max-md:-mx-4 max-md:h-full md:pr-6"
			class:max-md:hidden={showContent && browser}
			bind:this={navContainer}
		>
			<!-- Filter input -->
			<div class="px-2 py-2">
				<input
					bind:value={modelFilter}
					type="search"
					placeholder="Search by name"
					aria-label="Search models by name or id"
					class="w-full rounded-full border border-gray-300 bg-white px-4 py-1 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:ring-gray-700"
				/>
			</div>

			{#each data.models
				.filter((el) => !el.unlisted)
				.filter((el) => {
					const haystack = normalize(`${el.id} ${el.name ?? ""} ${el.displayName ?? ""}`);
					return queryTokens.every((q) => haystack.includes(q));
				}) as model}
				<button
					type="button"
					onclick={() => goto(`${base}/settings/models/${model.id}`)}
					class="group flex h-9 w-full flex-none items-center gap-1 rounded-lg px-3 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60 md:rounded-xl md:px-3 {model.id ===
					page.params.model
						? '!bg-gray-100 !text-gray-800 dark:!bg-gray-700 dark:!text-gray-200'
						: ''}"
					data-model-id={model.id}
					aria-label="Configure {model.displayName}"
				>
					<div class="mr-auto flex items-center gap-1 truncate">
						<span class="truncate">{model.displayName}</span>
						{#if model.isRouter}
							<IconOmni />
						{/if}
					</div>

					{#if $settings.multimodalOverrides?.[model.id] ?? model.multimodal}
						<span
							title="Supports image inputs (multimodal)"
							class="grid size-[21px] flex-none place-items-center rounded-md border border-blue-700 dark:border-blue-500"
							aria-label="Model is multimodal"
							role="img"
						>
							<CarbonView class="text-xxs text-blue-700 dark:text-blue-500" />
						</span>
					{/if}

					{#if model.id === $settings.activeModel}
						<div
							class="flex h-[21px] items-center rounded-md bg-black/90 px-2 text-[11px] font-semibold leading-none text-white dark:bg-white dark:text-black"
						>
							Active
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
	{#if !(showContent && browser && !isDesktop(window)) && activeTab === 'personas'}
		<div
			class="scrollbar-custom col-span-1 flex flex-col overflow-y-auto whitespace-nowrap rounded-r-xl bg-gradient-to-l from-gray-50 to-10% dark:from-gray-700/40 max-md:-mx-4 max-md:h-full md:pr-6"
			class:max-md:hidden={showContent && browser}
			bind:this={navContainer}
		>
			<!-- Filter input -->
			<div class="px-2 py-2">
				<input
					bind:value={personaFilter}
					type="search"
					placeholder="Search by name"
					aria-label="Search personas by name"
					class="w-full rounded-full border border-gray-300 bg-white px-4 py-1 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:ring-gray-700"
				/>
			</div>

			{#each $settings.personas
				.filter((persona) => {
					const haystack = normalize(`${persona.name} ${persona.occupation ?? ""} ${persona.stance ?? ""}`);
					return personaQueryTokens.every((q) => haystack.includes(q));
				}) as persona (persona.id)}
				<button
					type="button"
					onclick={() => goto(`${base}/settings/personas/${persona.id}`)}
					ondblclick={() => handlePersonaDoubleClick(persona.id)}
					class="group flex h-9 w-full flex-none items-center gap-1 rounded-lg px-3 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60 md:rounded-xl md:px-3 {persona.id ===
					page.params.persona
						? '!bg-gray-100 !text-gray-800 dark:!bg-gray-700 dark:!text-gray-200'
						: ''}"
					data-persona-id={persona.id}
					aria-label="Select {persona.name}"
					title="Double-click to activate"
				>
					<div class="mr-auto flex items-center gap-1 truncate">
						<span class="truncate">{persona.name}</span>
					</div>

					{#if $settings.activePersonas.includes(persona.id)}
						<div class="size-2 rounded-full bg-black dark:bg-white" title="Active persona"></div>
					{/if}
				</button>
			{/each}

			<button
				type="button"
				onclick={createNewPersona}
				class="group sticky bottom-0 mt-1 flex h-9 w-full flex-none items-center justify-center gap-1 rounded-lg bg-white px-3 text-[13px] text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/60 md:rounded-xl md:px-3"
				aria-label="Create new persona"
			>
				+ New Persona
			</button>
		</div>
	{/if}
	{#if showContent}
		<div
			class="scrollbar-custom col-span-1 w-full overflow-y-auto overflow-x-clip px-1 {activeTab === 'models' || activeTab === 'personas' ? 'md:col-span-2' : 'md:col-span-3'} md:row-span-2"
			class:max-md:hidden={!showContent && browser}
		>
			{@render children?.()}
		</div>
	{/if}
</div>
