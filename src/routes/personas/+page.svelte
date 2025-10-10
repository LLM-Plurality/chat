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
			const haystack = normalize(`${p.name} ${p.age ?? ""} ${p.gender ?? ""} ${p.jobSector ?? ""} ${p.stance ?? ""}`);
			return queryTokens.every((q) => haystack.includes(q));
		})
	);

	function togglePersona(personaId: string) {
		const isActive = $settings.activePersonas.includes(personaId);
		if (isActive) {
			// Prevent deactivating the last active persona
			if ($settings.activePersonas.length === 1) {
				alert("At least one persona must be active.");
				return;
			}
			// Deactivate: remove from array
			settings.instantSet({ activePersonas: $settings.activePersonas.filter(id => id !== personaId) });
		} else {
			// Activate: add to array
			settings.instantSet({ activePersonas: [...$settings.activePersonas, personaId] });
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
		togglePersona(personaId);
	}

	// Edit modal state
	let editingPersonaId = $state<string | null>(null);
	let editingPersona = $derived(
		$settings.personas.find((p) => p.id === editingPersonaId) ?? null
	);
	let editableName = $state("");
	let editableAge = $state("");
	let editableGender = $state("");
	let editableJobSector = $state("");
	let editableStance = $state("");
	let editableCommunicationStyle = $state("");
	let editableGoalInDebate = $state("");
	let editableIncomeBracket = $state("");
	let editablePoliticalLeanings = $state("");
	let editableGeographicContext = $state("");

	$effect(() => {
		if (editingPersona) {
			editableName = editingPersona.name;
			editableAge = editingPersona.age;
			editableGender = editingPersona.gender;
			editableJobSector = editingPersona.jobSector || "";
			editableStance = editingPersona.stance || "";
			editableCommunicationStyle = editingPersona.communicationStyle || "";
			editableGoalInDebate = editingPersona.goalInDebate || "";
			editableIncomeBracket = editingPersona.incomeBracket || "";
			editablePoliticalLeanings = editingPersona.politicalLeanings || "";
			editableGeographicContext = editingPersona.geographicContext || "";
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
					age: editableAge,
					gender: editableGender,
					jobSector: editableJobSector,
					stance: editableStance,
					communicationStyle: editableCommunicationStyle,
					goalInDebate: editableGoalInDebate,
					incomeBracket: editableIncomeBracket,
					politicalLeanings: editablePoliticalLeanings,
					geographicContext: editableGeographicContext,
					updatedAt: new Date(),
				}
				: p
		);
		closeEdit();
	}

    function toggleEditingPersona() {
        if (!editingPersona) return;
        const id = editingPersona.id;
        saveEdit();
        togglePersona(id);
    }

	function deleteEditingPersona() {
		if (!editingPersona) return;
		if ($settings.personas.length === 1) return alert("Cannot delete the last persona.");
		if ($settings.activePersonas.includes(editingPersona.id))
			return alert("Cannot delete an active persona. Deactivate it first.");
		if (confirm(`Delete "${editingPersona.name}"?`)) {
			$settings.personas = $settings.personas.filter((p) => p.id !== editingPersona!.id);
			closeEdit();
		}
	}

	// Function to show datalist on focus
	function showDatalist(event: FocusEvent) {
		const input = event.target as HTMLInputElement;
		// Dispatch a synthetic input event to trigger the datalist dropdown
		input.dispatchEvent(new Event('input', { bubbles: true }));
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
			placeholder="Search by name, age, gender, job sector, or stance"
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
                    class="group relative flex min-h-[112px] flex-col gap-2 overflow-hidden rounded-xl bg-gray-50/50 px-6 py-5 text-left shadow hover:bg-gray-50 hover:shadow-inner dark:bg-gray-950/20 dark:hover:bg-gray-950/40 {$settings.activePersonas.includes(persona.id) ? 'border-2 border-black dark:border-white' : 'border border-gray-800/70'}"
				>
					<div class="flex items-center justify-between gap-1">
						<span class="flex items-center gap-2 font-semibold">{persona.name}</span>
						{#if $settings.activePersonas.includes(persona.id)}
							<div class="size-2.5 rounded-full bg-black dark:bg-white" title="Active persona"></div>
						{/if}
					</div>
					<div class="text-sm text-gray-600 dark:text-gray-300">
						{#if persona.age || persona.gender}
							<div class="mb-1">
								{#if persona.age}<span>{persona.age}</span>{/if}
								{#if persona.age && persona.gender}<span class="mx-1 text-gray-400">•</span>{/if}
								{#if persona.gender}<span>{persona.gender}</span>{/if}
							</div>
						{/if}
						{#if persona.jobSector || persona.stance}
							<div>
								{#if persona.jobSector}<span class="font-medium">{persona.jobSector}</span>{/if}
								{#if persona.jobSector && persona.stance}<span class="mx-1 text-gray-400">•</span>{/if}
								{#if persona.stance}<span class="italic">{persona.stance}</span>{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

{#if editingPersona}
    <Modal onclose={() => {
        const dirty = editingPersona && (
            editableName !== editingPersona.name ||
            editableAge !== editingPersona.age ||
            editableGender !== editingPersona.gender ||
            editableJobSector !== (editingPersona.jobSector || "") ||
            editableStance !== (editingPersona.stance || "") ||
            editableCommunicationStyle !== (editingPersona.communicationStyle || "") ||
            editableGoalInDebate !== (editingPersona.goalInDebate || "") ||
            editableIncomeBracket !== (editingPersona.incomeBracket || "") ||
            editablePoliticalLeanings !== (editingPersona.politicalLeanings || "") ||
            editableGeographicContext !== (editingPersona.geographicContext || "")
        );
        if (!dirty) return closeEdit();
        showCloseConfirm = true;
    }} width="w-full !max-w-4xl">
		<div class="scrollbar-custom flex h-full max-h-[85vh] w-full flex-col gap-5 overflow-y-auto p-6">
			<div class="text-xl font-semibold text-gray-800 dark:text-gray-200">Edit Persona</div>
			
			<!-- Group 1: Core Identity -->
			<div>
				<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Core Identity</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
					<div class="flex flex-col gap-2">
						<label for="edit-name" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Name <span class="text-red-500">*</span>
						</label>
						<input
							id="edit-name"
							type="text"
							bind:value={editableName}
							required
							class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
							maxlength="100"
						/>
					</div>

					<div class="flex flex-col gap-2">
						<label for="edit-age" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Age <span class="text-red-500">*</span>
						</label>
						<input
							id="edit-age"
							type="text"
							list="edit-age-options"
							bind:value={editableAge}
							onfocus={showDatalist}
							required
							class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
							maxlength="50"
						/>
						<datalist id="edit-age-options">
							<option value="18-25">18-25</option>
							<option value="26-35">26-35</option>
							<option value="36-45">36-45</option>
							<option value="46-55">46-55</option>
							<option value="56-65">56-65</option>
							<option value="66+">66+</option>
						</datalist>
					</div>

					<div class="flex flex-col gap-2">
						<label for="edit-gender" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Gender <span class="text-red-500">*</span>
						</label>
						<input
							id="edit-gender"
							type="text"
							list="edit-gender-options"
							bind:value={editableGender}
							onfocus={showDatalist}
							required
							class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
							maxlength="50"
						/>
						<datalist id="edit-gender-options">
							<option value="Male">Male</option>
							<option value="Female">Female</option>
							<option value="Prefer not to say">Prefer not to say</option>
						</datalist>
					</div>
				</div>
			</div>

			<!-- Group 2: Professional & Stance -->
			<div>
				<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Professional & Stance</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
					<div class="flex flex-col gap-2">
						<label for="edit-job-sector" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Job Sector
						</label>
						<input
							id="edit-job-sector"
							type="text"
							list="edit-job-sector-options"
							bind:value={editableJobSector}
							onfocus={showDatalist}
							class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
							maxlength="200"
						/>
						<datalist id="edit-job-sector-options">
							<option value="Healthcare provider">Healthcare provider</option>
							<option value="Small business owner">Small business owner</option>
							<option value="Tech worker">Tech worker</option>
							<option value="Teacher">Teacher</option>
							<option value="Unemployed/Retired">Unemployed/Retired</option>
							<option value="Government worker">Government worker</option>
							<option value="Student">Student</option>
						</datalist>
					</div>

					<div class="flex flex-col gap-2">
						<label for="edit-stance" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Stance
						</label>
						<input
							id="edit-stance"
							type="text"
							list="edit-stance-options"
							bind:value={editableStance}
							onfocus={showDatalist}
							class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
							maxlength="200"
						/>
						<datalist id="edit-stance-options">
							<option value="In Favor of Medicare for All">In Favor of Medicare for All</option>
							<option value="Hardline Insurance Advocate">Hardline Insurance Advocate</option>
							<option value="Improvement of Current System">Improvement of Current System</option>
							<option value="Public Option Supporter">Public Option Supporter</option>
							<option value="Status Quo">Status Quo</option>
						</datalist>
					</div>
				</div>
			</div>

			<!-- Group 3: Communication & Goals -->
			<div>
				<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Communication & Goals</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
					<div class="flex flex-col gap-2">
						<label for="edit-communication-style" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Communication Style
						</label>
						<input
							id="edit-communication-style"
							type="text"
							list="edit-communication-style-options"
							bind:value={editableCommunicationStyle}
							onfocus={showDatalist}
							class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
							maxlength="200"
						/>
						<datalist id="edit-communication-style-options">
							<option value="Direct">Direct</option>
							<option value="Technical/Jargon use">Technical/Jargon use</option>
							<option value="Informal">Informal</option>
							<option value="Philosophical">Philosophical</option>
							<option value="Pragmatic">Pragmatic</option>
							<option value="Conversational">Conversational</option>
						</datalist>
					</div>

					<div class="flex flex-col gap-2">
						<label for="edit-goal-in-debate" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Goal in the Debate
						</label>
						<input
							id="edit-goal-in-debate"
							type="text"
							list="edit-goal-in-debate-options"
							bind:value={editableGoalInDebate}
							onfocus={showDatalist}
							class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
							maxlength="300"
						/>
						<datalist id="edit-goal-in-debate-options">
							<option value="Keep discussion grounded">Keep discussion grounded</option>
							<option value="Explain complexity">Explain complexity</option>
							<option value="Advocate for change">Advocate for change</option>
							<option value="Defend current system">Defend current system</option>
							<option value="Find compromise">Find compromise</option>
						</datalist>
					</div>
				</div>
			</div>

			<!-- Group 4: Demographics -->
			<div>
				<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Demographics</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
					<div class="flex flex-col gap-2">
						<label for="edit-income-bracket" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Income Bracket
						</label>
						<input
							id="edit-income-bracket"
							type="text"
							list="edit-income-bracket-options"
							bind:value={editableIncomeBracket}
							onfocus={showDatalist}
							class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
							maxlength="100"
						/>
						<datalist id="edit-income-bracket-options">
							<option value="Low">Low</option>
							<option value="Middle">Middle</option>
							<option value="High">High</option>
							<option value="Comfortable">Comfortable</option>
							<option value="Struggling">Struggling</option>
						</datalist>
					</div>

					<div class="flex flex-col gap-2">
						<label for="edit-political-leanings" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Political Leanings
						</label>
						<input
							id="edit-political-leanings"
							type="text"
							list="edit-political-leanings-options"
							bind:value={editablePoliticalLeanings}
							onfocus={showDatalist}
							class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
							maxlength="100"
						/>
						<datalist id="edit-political-leanings-options">
							<option value="Liberal">Liberal</option>
							<option value="Conservative">Conservative</option>
							<option value="Moderate">Moderate</option>
							<option value="Libertarian">Libertarian</option>
							<option value="Non-affiliated">Non-affiliated</option>
							<option value="Progressive">Progressive</option>
						</datalist>
					</div>

					<div class="flex flex-col gap-2">
						<label for="edit-geographic-context" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Geographic Context
						</label>
						<input
							id="edit-geographic-context"
							type="text"
							list="edit-geographic-context-options"
							bind:value={editableGeographicContext}
							onfocus={showDatalist}
							class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
							maxlength="100"
						/>
						<datalist id="edit-geographic-context-options">
							<option value="Rural">Rural</option>
							<option value="Urban">Urban</option>
							<option value="Suburban">Suburban</option>
						</datalist>
					</div>
				</div>
			</div>

            <div class="flex flex-wrap gap-2 pt-2">
                <button
                    class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    onclick={toggleEditingPersona}
                >
                    {$settings.activePersonas.includes(editingPersona.id) ? "Deactivate" : "Activate"}
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


