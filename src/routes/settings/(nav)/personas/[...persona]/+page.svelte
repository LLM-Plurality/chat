<script lang="ts">
    import { base } from "$app/paths";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { useSettingsStore } from "$lib/stores/settings";
	import SelectField from "$lib/components/SelectField.svelte";
	import ComboboxField from "$lib/components/ComboboxField.svelte";
    import CarbonTrashCan from "~icons/carbon/trash-can";
	import type { Persona } from "$lib/types/Persona";
	import { debounce } from "$lib/utils/debounce";

    const settings = useSettingsStore();

    // Selected persona comes from the URL param to mirror model routing
	const availablePersonas = $derived($settings.personas.filter((persona) => !persona.archived));
	let selectedPersonaId = $derived.by(() => {
		const paramId = page.params.persona;
		// If URL param exists and persona exists (even if archived), use it
		if (paramId && $settings.personas.some((persona) => persona.id === paramId)) {
			return paramId;
		}
		// Otherwise use first available persona
		return availablePersonas[0]?.id ?? null;
	});
    let selectedPersona = $derived(
		$settings.personas.find((persona) => persona.id === selectedPersonaId) ?? null
	);

	// Core update function - shared by both debounced and immediate updates
	function updatePersona(field: keyof Persona, value: string) {
		if (!selectedPersona || selectedPersona.locked) return;
		$settings.personas = $settings.personas.map((p) =>
			p.id === selectedPersona.id ? { ...p, [field]: value, updatedAt: new Date() } : p
		);
	}

	// Debounced update for text inputs (triggered on blur)
	const updatePersonaField = debounce(updatePersona, 300);

	// Immediate update for selects/dropdowns
	const updatePersonaImmediate = updatePersona;

	function togglePersona() {
		if (!selectedPersona) return;
		
		const isActive = $settings.activePersonas.includes(selectedPersona.id);
		if (isActive) {
			// Prevent deactivating the last active persona
			if ($settings.activePersonas.length === 1) {
				alert("At least one persona must be active.");
				return;
			}
			// Deactivate: remove from array
			settings.instantSet({ activePersonas: $settings.activePersonas.filter(id => id !== selectedPersona.id) });
		} else {
			// Activate: add to array
			settings.instantSet({ activePersonas: [...$settings.activePersonas, selectedPersona.id] });
		}
	}

	async function deletePersona() {
		if (!selectedPersona) return;

		// Can't delete if it's locked
		if (selectedPersona.locked) {
			alert("Cannot delete a locked persona.");
			return;
		}

		const nonArchivedCount = $settings.personas.filter((persona) => !persona.archived).length;
		if (nonArchivedCount <= 1) {
			alert("Cannot delete the last persona.");
			return;
		}

		// Can't delete if it's an active persona
		if ($settings.activePersonas.includes(selectedPersona.id)) {
			alert("Cannot delete an active persona. Please deactivate it first.");
			return;
		}

		if (
			confirm(
				`Are you sure you want to remove "${selectedPersona.name}"? Past responses will continue to show their persona details, but this persona will be hidden from future use.`
			)
		) {
			try {
				const usageResponse = await fetch(
					`${base}/api/personas/${selectedPersona.id}/usage`
				);

				if (!usageResponse.ok) {
					alert("Unable to delete persona right now. Please try again later.");
					return;
				}

				const { used } = (await usageResponse.json()) as { used: boolean };
				const now = new Date();
				const filteredActive = $settings.activePersonas.filter((id) => id !== selectedPersona.id);
				const updatedPersonas = used
					? $settings.personas.map((persona) =>
							persona.id === selectedPersona.id
								? { ...persona, archived: true, updatedAt: now }
								: persona
					  )
					: $settings.personas.filter((persona) => persona.id !== selectedPersona.id);

				await settings.instantSet({
					personas: updatedPersonas,
					activePersonas: filteredActive,
				});

				const nextCandidate = updatedPersonas.find(
					(persona) => !persona.archived && persona.id !== selectedPersona.id
				);
				const fallbackPersona = updatedPersonas.find((persona) => !persona.archived)?.id ?? "";
				const targetId = nextCandidate?.id ?? fallbackPersona;
				goto(`${base}/settings/personas/${targetId}`);
			} catch (error) {
				console.error("Failed to delete persona", error);
				alert("Unable to delete persona right now. Please try again later.");
			}
		}
	}

	// Options for SelectFields
	const ageOptions = ["18-25", "26-35", "36-45", "46-55", "56-65", "66+"];
	const genderOptions = ["Male", "Female", "Prefer not to say"];
	const incomeBracketOptions = ["Low", "Middle", "High", "Comfortable", "Struggling"];
	const politicalLeaningsOptions = ["Liberal", "Conservative", "Moderate", "Libertarian", "Non-affiliated", "Progressive"];
	const geographicContextOptions = ["Rural", "Urban", "Suburban"];

	// Suggestions for ComboboxFields
	const jobSectorSuggestions = [
		"Healthcare provider",
		"Small business owner",
		"Tech worker",
		"Teacher",
		"Unemployed/Retired",
		"Government worker",
		"Student"
	];
	const stanceSuggestions = [
		"In Favor of Medicare for All",
		"Hardline Insurance Advocate",
		"Improvement of Current System",
		"Public Option Supporter",
		"Status Quo"
	];
	const communicationStyleSuggestions = [
		"Direct",
		"Technical/Jargon use",
		"Informal",
		"Philosophical",
		"Pragmatic",
		"Conversational"
	];
	const goalInDebateSuggestions = [
		"Keep discussion grounded",
		"Explain complexity",
		"Advocate for change",
		"Defend current system",
		"Find compromise"
	];
</script>

<!-- Persona Detail View -->
{#if selectedPersona}
	<div class="flex w-full flex-col gap-6">
		<!-- Header Section -->
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<h2 class="text-base font-semibold md:text-lg">
					{selectedPersona.name}
				</h2>
				{#if selectedPersona.locked}
					<span class="flex h-[20px] items-center rounded-full border border-amber-500 px-2 text-[11px] font-medium uppercase tracking-tight text-amber-700 dark:border-amber-400 dark:text-amber-300">
						Locked
					</span>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
				{#if selectedPersona.age}
					<span>{selectedPersona.age}</span>
				{/if}
				{#if selectedPersona.age && selectedPersona.gender}
					<span aria-hidden="true">•</span>
				{/if}
				{#if selectedPersona.gender}
					<span>{selectedPersona.gender}</span>
				{/if}
				{#if (selectedPersona.age || selectedPersona.gender) && selectedPersona.jobSector}
					<span aria-hidden="true">•</span>
				{/if}
				{#if selectedPersona.jobSector}
					<span>{selectedPersona.jobSector}</span>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex flex-wrap items-center gap-2">
			<button
				class="flex w-fit items-center rounded-full bg-black px-3 py-1.5 text-sm !text-white shadow-sm hover:bg-black/90 dark:bg-white/80 dark:!text-gray-900 dark:hover:bg-white/90"
				onclick={togglePersona}
			>
				{$settings.activePersonas.includes(selectedPersona.id) ? "Deactivate" : "Activate"}
			</button>

			{#if !selectedPersona.locked}
				<button
					class="inline-flex items-center rounded-full border border-red-200 px-2.5 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
					onclick={deletePersona}
				>
					<CarbonTrashCan class="mr-1.5 shrink-0 text-xs" />
					Delete
				</button>
			{/if}
		</div>

		<!-- Form Fields -->
		<div class="w-full space-y-6">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
					<div class="flex flex-col gap-2">
						<label for="persona-name" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Name <span class="text-red-500">*</span>
						</label>
							<input
								id="persona-name"
								type="text"
						value={selectedPersona.name}
								required
						disabled={selectedPersona.locked}
						onblur={(e) => updatePersonaField('name', e.currentTarget.value)}
						class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800"
								maxlength="100"
							/>
					</div>

				<div class="w-full md:w-32">
					<SelectField
						label="Age"
						value={selectedPersona.age}
						options={ageOptions}
						disabled={selectedPersona.locked}
						required={true}
						onChange={(value) => updatePersonaImmediate('age', value)}
					/>
					</div>

				<div class="w-full md:w-40">
					<SelectField
						label="Gender"
						value={selectedPersona.gender}
						options={genderOptions}
						disabled={selectedPersona.locked}
						required={true}
						onChange={(value) => updatePersonaImmediate('gender', value)}
					/>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<ComboboxField
					label="Job Sector"
					value={selectedPersona.jobSector || ""}
					suggestions={jobSectorSuggestions}
					disabled={selectedPersona.locked}
					maxlength={200}
					onChange={(value) => updatePersonaField('jobSector', value)}
				/>

				<ComboboxField
					label="Stance"
					value={selectedPersona.stance || ""}
					suggestions={stanceSuggestions}
					disabled={selectedPersona.locked}
					maxlength={200}
					onChange={(value) => updatePersonaField('stance', value)}
				/>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<ComboboxField
					label="Communication Style"
					value={selectedPersona.communicationStyle || ""}
					suggestions={communicationStyleSuggestions}
					disabled={selectedPersona.locked}
					maxlength={200}
					onChange={(value) => updatePersonaField('communicationStyle', value)}
				/>

				<ComboboxField
					label="Goal in the Debate"
					value={selectedPersona.goalInDebate || ""}
					suggestions={goalInDebateSuggestions}
					disabled={selectedPersona.locked}
					maxlength={300}
					onChange={(value) => updatePersonaField('goalInDebate', value)}
				/>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<SelectField
					label="Income Bracket"
					value={selectedPersona.incomeBracket || ""}
					options={incomeBracketOptions}
					disabled={selectedPersona.locked}
					onChange={(value) => updatePersonaImmediate('incomeBracket', value)}
				/>

				<SelectField
					label="Political Leanings"
					value={selectedPersona.politicalLeanings || ""}
					options={politicalLeaningsOptions}
					disabled={selectedPersona.locked}
					onChange={(value) => updatePersonaImmediate('politicalLeanings', value)}
				/>

				<SelectField
					label="Geographic Context"
					value={selectedPersona.geographicContext || ""}
					options={geographicContextOptions}
					disabled={selectedPersona.locked}
					onChange={(value) => updatePersonaImmediate('geographicContext', value)}
				/>
				</div>
		</div>
	</div>
{/if}
