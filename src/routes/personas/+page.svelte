<script lang="ts">
	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";
	import { useSettingsStore } from "$lib/stores/settings";
	import type { Persona } from "$lib/types/Persona";
	import { page } from "$app/state";
	import Modal from "$lib/components/Modal.svelte";
	import CarbonEdit from "~icons/carbon/edit";

	const publicConfig = usePublicConfig();
	const settings = useSettingsStore();

	let clickTimeout: number | null = null;
	let showCloseConfirm = $state(false);

	// Local filter state for persona search (hyphen/space insensitive)
	let personaFilter = $state("");
	const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ");
	let queryTokens = $derived(normalize(personaFilter).trim().split(/\s+/).filter(Boolean));
    let filtered = $derived(
		$settings.personas.filter((p: Persona) => {
			const haystack = normalize(`${p.name} ${p.occupation ?? ""} ${p.stance ?? ""}`);
			return queryTokens.every((q) => haystack.includes(q));
		})
	);

	function activatePersona(personaId: string) {
		if (personaId !== $settings.activePersona) {
			settings.instantSet({ activePersona: personaId });
		}
	}

	function handleCardClick(personaId: string) {
		if (clickTimeout) return; // waiting for dblclick
		clickTimeout = window.setTimeout(() => {
			clickTimeout = null;
			openEdit(personaId);
		}, 220);
	}

	function handleCardDblClick(personaId: string) {
		if (clickTimeout) {
			clearTimeout(clickTimeout);
			clickTimeout = null;
		}
		activatePersona(personaId);
	}

	// Edit modal state
	let editingPersonaId = $state<string | null>(null);
	let editingPersona = $derived(
		$settings.personas.find((p) => p.id === editingPersonaId) ?? null
	);
	let editableName = $state("");
	let editableOccupation = $state("");
	let editableStance = $state("");
	let editablePrompt = $state("");

	$effect(() => {
		if (editingPersona) {
			editableName = editingPersona.name;
			editableOccupation = editingPersona.occupation;
			editableStance = editingPersona.stance;
			editablePrompt = editingPersona.prompt;
		}
	});

	function openEdit(personaId: string) {
		editingPersonaId = personaId;
	}

function closeEdit() {
		editingPersonaId = null;
	}

	function saveEdit() {
		if (!editingPersona) return;
		$settings.personas = $settings.personas.map((p) =>
			p.id === editingPersona.id
				? {
					...p,
					name: editableName,
					occupation: editableOccupation,
					stance: editableStance,
					prompt: editablePrompt,
					updatedAt: new Date(),
				}
				: p
		);
		closeEdit();
	}

    function activateEditingPersona() {
        if (!editingPersona) return;
        const id = editingPersona.id;
        saveEdit();
        activatePersona(id);
    }

	function deleteEditingPersona() {
		if (!editingPersona) return;
		if ($settings.personas.length === 1) return alert("Cannot delete the last persona.");
		if (editingPersona.id === $settings.activePersona)
			return alert("Cannot delete the active persona. Activate another first.");
		if (confirm(`Delete "${editingPersona.name}"?`)) {
			$settings.personas = $settings.personas.filter((p) => p.id !== editingPersona!.id);
			closeEdit();
		}
	}
</script>

<svelte:head>
	<title>{publicConfig.PUBLIC_APP_NAME} - Personas</title>
	<meta property="og:title" content="Personas" />
	<meta property="og:url" content={page.url.href} />
</svelte:head>

<div class="scrollbar-custom h-full overflow-y-auto py-12 max-sm:pt-8 md:py-24">
	<div class="pt-42 mx-auto flex flex-col px-5 xl:w-[60rem] 2xl:w-[64rem]">
		<div class="flex items-center">
			<h1 class="text-2xl font-bold">Personas</h1>
		</div>
		<h2 class="text-gray-500">All personas available on {publicConfig.PUBLIC_APP_NAME}</h2>

		<!-- Filter input -->
		<input
			type="search"
			bind:value={personaFilter}
			placeholder="Search by name, occupation, or stance"
			aria-label="Search personas"
			class="mt-4 w-full rounded-3xl border border-gray-300 bg-white px-5 py-2 text-[15px]
				placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300
				dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-gray-700"
		/>

		<div class="mt-6 grid grid-cols-1 gap-3 sm:gap-5 xl:grid-cols-2">
			{#each filtered as persona (persona.id)}
                <div
                    role="button"
                    tabindex="0"
                    onclick={() => handleCardClick(persona.id)}
                    ondblclick={() => handleCardDblClick(persona.id)}
                    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(persona.id); } }}
					aria-label={`Open persona ${persona.name}`}
                    class="group relative flex min-h-[112px] flex-col gap-2 overflow-hidden rounded-xl border bg-gray-50/50 px-6 py-5 text-left shadow hover:bg-gray-50 hover:shadow-inner dark:border-gray-800/70 dark:bg-gray-950/20 dark:hover:bg-gray-950/40"
					class:active-model={persona.id === $settings.activePersona}
				>
					<div class="flex items-center justify-between gap-1">
						<span class="flex items-center gap-2 font-semibold">{persona.name}</span>
						{#if persona.id === $settings.activePersona}
							<span class="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">Active</span>
						{/if}
					</div>
					{#if persona.occupation || persona.stance}
						<div class="text-sm text-gray-600 dark:text-gray-300">
							{#if persona.occupation}<span class="font-medium">{persona.occupation}</span>{/if}
							{#if persona.occupation && persona.stance}<span class="mx-1 text-gray-400">•</span>{/if}
							{#if persona.stance}<span class="italic">{persona.stance}</span>{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>

{#if editingPersona}
    <Modal onclose={() => {
        const dirty = editingPersona && (
            editableName !== editingPersona.name ||
            editableOccupation !== editingPersona.occupation ||
            editableStance !== editingPersona.stance ||
            editablePrompt !== editingPersona.prompt
        );
        if (!dirty) return closeEdit();
        showCloseConfirm = true;
    }} width="w-full !max-w-2xl">
		<div class="flex h-full max-h-[80vh] w-full flex-col gap-5 p-6">
		<div class="text-xl font-semibold text-gray-800 dark:text-gray-200">Edit Persona</div>
			<div class="flex flex-col gap-2">
				<label for="edit-name" class="text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
				<div class="relative">
					<input
						id="edit-name"
						bind:value={editableName}
						class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
					/>
					<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<label for="edit-role" class="text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
				<div class="relative">
					<input
						id="edit-role"
						bind:value={editableOccupation}
						class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
					/>
					<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<label for="edit-stance" class="text-sm font-medium text-gray-700 dark:text-gray-300">Stance</label>
				<div class="relative">
					<input
						id="edit-stance"
						bind:value={editableStance}
						class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
					/>
					<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
				</div>
			</div>
			<div class="flex min-h-0 flex-1 flex-col gap-2">
				<label for="edit-prompt" class="text-sm font-medium text-gray-700 dark:text-gray-300">System Prompt</label>
				<div class="relative flex flex-1">
					<textarea
						id="edit-prompt"
						bind:value={editablePrompt}
						class="peer scrollbar-custom h-full min-h-[200px] w-full flex-1 resize-none overflow-y-auto rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
					></textarea>
					<CarbonEdit class="pointer-events-none absolute right-3 top-3 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
				</div>
			</div>
            <div class="flex flex-wrap gap-2 pt-2">
                <button
                    class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    onclick={activateEditingPersona}
                    disabled={editingPersona.id === $settings.activePersona}
                >
                    {editingPersona.id === $settings.activePersona ? "Active" : "Activate"}
                </button>
				<button
					class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
					onclick={saveEdit}
				>
					Save
				</button>
				<button
					class="ml-auto flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:hover:bg-red-900/20"
					onclick={deleteEditingPersona}
				>
					Delete
				</button>
			</div>
		</div>
	</Modal>
{/if}

{#if editingPersona && showCloseConfirm}
    <Modal onclose={() => (showCloseConfirm = false)} width="w-full !max-w-sm">
        <div class="flex w-full flex-col gap-4 p-4">
            <div class="text-base font-semibold text-gray-800 dark:text-gray-200">Unsaved changes</div>
            <p class="text-sm text-gray-600 dark:text-gray-300">Save your changes before closing?</p>
            <div class="mt-2 flex gap-2">
                <button class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300" onclick={() => { showCloseConfirm = false; saveEdit(); }}>
                    Save
                </button>
                <button class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300" onclick={() => { showCloseConfirm = false; closeEdit(); }}>
                    Discard
                </button>
                <button class="ml-auto rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300" onclick={() => { showCloseConfirm = false; }}>
                    Cancel
                </button>
            </div>
        </div>
    </Modal>
{/if}

<!-- merged into top script -->


