<script lang="ts">
    import { base } from "$app/paths";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { useSettingsStore } from "$lib/stores/settings";
    import type { Persona } from "$lib/types/Persona";
    import { v4 } from "uuid";
    import CarbonTrashCan from "~icons/carbon/trash-can";

    const settings = useSettingsStore();

    // Selected persona comes from the URL param to mirror model routing
    let selectedPersonaId = $state<string | null>(page.params.persona ?? null);
    let selectedPersona = $derived(
        $settings.personas.find((p) => p.id === selectedPersonaId) ?? $settings.personas[0]
    );

    // Keep URL in sync if selection changes locally
    $effect(() => {
        const id = selectedPersona?.id;
        if (!id) return;
        if (page.params.persona !== id) {
            goto(`${base}/settings/personas/${id}`);
        }
    });

    // Local editable copy of selected persona
    let editableName = $state("");
    let editableOccupation = $state("");
    let editableStance = $state("");
    let editablePrompt = $state("");

    // Search filter
    let personaFilter = $state("");
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    let queryTokens = $derived(normalize(personaFilter).trim().split(/\s+/).filter(Boolean));
    let filteredPersonas = $derived(
        $settings.personas.filter((persona) => {
            const haystack = normalize(
                `${persona.name} ${persona.occupation ?? ""} ${persona.stance ?? ""}`
            );
            return queryTokens.every((q) => haystack.includes(q));
        })
    );

    // Update editable fields when selection changes
    $effect(() => {
        if (selectedPersona) {
            editableName = selectedPersona.name;
            editableOccupation = selectedPersona.occupation;
            editableStance = selectedPersona.stance;
            editablePrompt = selectedPersona.prompt;
        }
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

    function savePersona() {
        if (!selectedPersona) return;

        const updatedPersonas = $settings.personas.map((p) =>
            p.id === selectedPersona.id
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

        $settings.personas = updatedPersonas;
    }

    function activatePersona() {
        if (!selectedPersona) return;
        if (hasChanges) savePersona();
        settings.instantSet({ activePersona: selectedPersona.id });
    }

    function deletePersona() {
        if (!selectedPersona) return;

        // Can't delete if it's the only persona
        if ($settings.personas.length === 1) {
            alert("Cannot delete the last persona.");
            return;
        }

        // Can't delete if it's the active persona
        if (selectedPersona.id === $settings.activePersona) {
            alert("Cannot delete the currently active persona. Please activate another persona first.");
            return;
        }

        if (confirm(`Are you sure you want to delete "${selectedPersona.name}"?`)) {
            const nextId = $settings.personas.find((p) => p.id !== selectedPersona!.id)?.id || null;
            $settings.personas = $settings.personas.filter((p) => p.id !== selectedPersona.id);
            goto(`${base}/settings/personas/${nextId ?? ""}`);
        }
    }

    function handleDoubleClick(personaId: string) {
        if (selectedPersona && hasChanges) savePersona();
        if (personaId !== $settings.activePersona) {
            settings.instantSet({ activePersona: personaId });
        }
        goto(`${base}/settings/personas/${personaId}`);
    }

    let hasChanges = $derived(
        selectedPersona &&
            (editableName !== selectedPersona.name ||
                editableOccupation !== selectedPersona.occupation ||
                editableStance !== selectedPersona.stance ||
                editablePrompt !== selectedPersona.prompt)
    );
</script>

<div class="grid h-full w-full grid-cols-1 grid-rows-[1fr] gap-x-6 md:grid-cols-3">
	<!-- Left Panel - Persona List -->
	<div
		class="scrollbar-custom col-span-1 flex flex-col overflow-y-auto whitespace-nowrap rounded-r-xl bg-gradient-to-l from-gray-50 to-10% dark:from-gray-700/40 md:pr-6"
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

        {#each filteredPersonas as persona (persona.id)}
            <button
				type="button"
                onclick={() => goto(`${base}/settings/personas/${persona.id}`)}
				ondblclick={() => handleDoubleClick(persona.id)}
				class="group relative flex h-9 w-full flex-none items-center gap-1 rounded-lg px-3 text-[13px] transition-all {selectedPersonaId ===
				persona.id
                    ? '!bg-gray-100 !text-gray-800 dark:!bg-gray-700 dark:!text-gray-200'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60'} md:rounded-xl md:px-3"
				aria-label="Select {persona.name}"
			>
				<div class="mr-auto flex items-center gap-1 truncate">
                    <span class="truncate">{persona.name}</span>
				</div>
                {#if persona.id === $settings.activePersona}
                    <div
                        class="flex h-[21px] items-center rounded-md bg-black/90 px-2 text-[11px] font-semibold leading-none text-white dark:bg-white dark:text-black"
                    >
                        Active
                    </div>
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

	<!-- Right Panel - Persona Detail View -->
	{#if selectedPersona}
        <div class="scrollbar-custom col-span-2 flex h-full w-full flex-col overflow-y-auto px-1">
            <div class="grid grid-cols-1 gap-4 pb-24 md:grid-cols-3 md:gap-6">
                <div class="flex flex-col gap-2 md:col-span-1">
					<label for="persona-name" class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Persona Name
					</label>
					<input
						id="persona-name"
						type="text"
						bind:value={editableName}
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
						maxlength="100"
					/>
				</div>

                <div class="flex flex-col gap-2 md:col-span-1">
                    <label for="occupation" class="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Role
					</label>
					<input
						id="occupation"
						type="text"
						bind:value={editableOccupation}
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
						maxlength="200"
					/>
				</div>

                <div class="flex flex-col gap-2 md:col-span-1">
					<label for="stance" class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Stance
					</label>
					<input
						id="stance"
						type="text"
						bind:value={editableStance}
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
						maxlength="200"
					/>
				</div>

                <div class="flex flex-col gap-2 md:col-span-2">
					<label for="system-prompt" class="text-sm font-medium text-gray-700 dark:text-gray-300">
						System Prompt
					</label>
					<textarea
						id="system-prompt"
						bind:value={editablePrompt}
                        rows="18"
						class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
						maxlength="10000"
					></textarea>
				</div>
			</div>

			<!-- Sticky buttons -->
			<div
				class="sticky bottom-0 flex flex-wrap gap-2 border-t border-gray-200 bg-white py-4 dark:border-gray-700 dark:bg-gray-900"
			>
                <button
                    class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
					onclick={activatePersona}
					disabled={selectedPersona.id === $settings.activePersona}
				>
					{selectedPersona.id === $settings.activePersona ? "Active" : "Activate"}
				</button>
				<button
					class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
					onclick={savePersona}
					disabled={!hasChanges}
				>
					Save
				</button>
				<button
					class="ml-auto flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:hover:bg-red-900/20"
					onclick={deletePersona}
				>
					<CarbonTrashCan />
					Delete
				</button>
			</div>
		</div>
	{/if}
</div>

