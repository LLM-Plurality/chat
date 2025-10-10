<script lang="ts">
    import { base } from "$app/paths";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { useSettingsStore } from "$lib/stores/settings";
    import CarbonTrashCan from "~icons/carbon/trash-can";
    import CarbonEdit from "~icons/carbon/edit";

    const settings = useSettingsStore();

    // Selected persona comes from the URL param to mirror model routing
    let selectedPersonaId = $derived(page.params.persona ?? $settings.personas[0]?.id ?? null);
    let selectedPersona = $derived(
        $settings.personas.find((p) => p.id === selectedPersonaId) ?? $settings.personas[0]
    );

    // Local editable copy of selected persona
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

    // Update editable fields when selection changes
    $effect(() => {
        if (selectedPersona) {
            editableName = selectedPersona.name;
            editableAge = selectedPersona.age;
            editableGender = selectedPersona.gender;
            editableJobSector = selectedPersona.jobSector || "";
            editableStance = selectedPersona.stance || "";
            editableCommunicationStyle = selectedPersona.communicationStyle || "";
            editableGoalInDebate = selectedPersona.goalInDebate || "";
            editableIncomeBracket = selectedPersona.incomeBracket || "";
            editablePoliticalLeanings = selectedPersona.politicalLeanings || "";
            editableGeographicContext = selectedPersona.geographicContext || "";
        }
    });

    function savePersona() {
        if (!selectedPersona) return;

        const updatedPersonas = $settings.personas.map((p) =>
            p.id === selectedPersona.id
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

        $settings.personas = updatedPersonas;
    }

	function togglePersona() {
		if (!selectedPersona) return;
		if (hasChanges) savePersona();
		
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

	function deletePersona() {
		if (!selectedPersona) return;

		// Can't delete if it's the only persona
		if ($settings.personas.length === 1) {
			alert("Cannot delete the last persona.");
			return;
		}

		// Can't delete if it's an active persona
		if ($settings.activePersonas.includes(selectedPersona.id)) {
			alert("Cannot delete an active persona. Please deactivate it first.");
			return;
		}

		if (confirm(`Are you sure you want to delete "${selectedPersona.name}"?`)) {
			const nextId = $settings.personas.find((p) => p.id !== selectedPersona!.id)?.id || null;
			$settings.personas = $settings.personas.filter((p) => p.id !== selectedPersona.id);
			goto(`${base}/settings/personas/${nextId ?? ""}`);
		}
	}

    let hasChanges = $derived(
        selectedPersona &&
            (editableName !== selectedPersona.name ||
                editableAge !== selectedPersona.age ||
                editableGender !== selectedPersona.gender ||
                editableJobSector !== (selectedPersona.jobSector || "") ||
                editableStance !== (selectedPersona.stance || "") ||
                editableCommunicationStyle !== (selectedPersona.communicationStyle || "") ||
                editableGoalInDebate !== (selectedPersona.goalInDebate || "") ||
                editableIncomeBracket !== (selectedPersona.incomeBracket || "") ||
                editablePoliticalLeanings !== (selectedPersona.politicalLeanings || "") ||
                editableGeographicContext !== (selectedPersona.geographicContext || ""))
    );

	// Function to show datalist on focus
	function showDatalist(event: FocusEvent) {
		const input = event.target as HTMLInputElement;
		// Dispatch a synthetic input event to trigger the datalist dropdown
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}
</script>

<!-- Persona Detail View -->
{#if selectedPersona}
	<div class="flex h-full w-full flex-col overflow-hidden">
		<div class="flex flex-col gap-6">
			<!-- Group 1: Core Identity -->
			<div>
				<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Core Identity</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
					<div class="flex flex-col gap-2">
						<label for="persona-name" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Name <span class="text-red-500">*</span>
						</label>
						<div class="relative">
							<input
								id="persona-name"
								type="text"
								bind:value={editableName}
								required
								class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
								maxlength="100"
							/>
							<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<label for="age" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Age <span class="text-red-500">*</span>
						</label>
						<div class="relative">
							<input
								id="age"
								type="text"
								list="age-options"
								bind:value={editableAge}
								onfocus={showDatalist}
								required
								class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
								maxlength="50"
							/>
							<datalist id="age-options">
								<option value="18-25">18-25</option>
								<option value="26-35">26-35</option>
								<option value="36-45">36-45</option>
								<option value="46-55">46-55</option>
								<option value="56-65">56-65</option>
								<option value="66+">66+</option>
							</datalist>
							<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<label for="gender" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Gender <span class="text-red-500">*</span>
						</label>
						<div class="relative">
							<input
								id="gender"
								type="text"
								list="gender-options"
								bind:value={editableGender}
								onfocus={showDatalist}
								required
								class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
								maxlength="50"
							/>
							<datalist id="gender-options">
								<option value="Male">Male</option>
								<option value="Female">Female</option>
								<option value="Prefer not to say">Prefer not to say</option>
							</datalist>
							<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
						</div>
					</div>
				</div>
			</div>

			<!-- Group 2: Professional & Stance -->
			<div>
				<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Professional & Stance</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
					<div class="flex flex-col gap-2">
						<label for="job-sector" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Job Sector
						</label>
						<div class="relative">
							<input
								id="job-sector"
								type="text"
								list="job-sector-options"
								bind:value={editableJobSector}
								onfocus={showDatalist}
								class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
								maxlength="200"
							/>
							<datalist id="job-sector-options">
								<option value="Healthcare provider">Healthcare provider</option>
								<option value="Small business owner">Small business owner</option>
								<option value="Tech worker">Tech worker</option>
								<option value="Teacher">Teacher</option>
								<option value="Unemployed/Retired">Unemployed/Retired</option>
								<option value="Government worker">Government worker</option>
								<option value="Student">Student</option>
							</datalist>
							<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<label for="stance" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Stance
						</label>
						<div class="relative">
							<input
								id="stance"
								type="text"
								list="stance-options"
								bind:value={editableStance}
								onfocus={showDatalist}
								class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
								maxlength="200"
							/>
							<datalist id="stance-options">
								<option value="In Favor of Medicare for All">In Favor of Medicare for All</option>
								<option value="Hardline Insurance Advocate">Hardline Insurance Advocate</option>
								<option value="Improvement of Current System">Improvement of Current System</option>
								<option value="Public Option Supporter">Public Option Supporter</option>
								<option value="Status Quo">Status Quo</option>
							</datalist>
							<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
						</div>
					</div>
				</div>
			</div>

			<!-- Group 3: Communication & Goals -->
			<div>
				<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Communication & Goals</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
					<div class="flex flex-col gap-2">
						<label for="communication-style" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Communication Style
						</label>
						<div class="relative">
							<input
								id="communication-style"
								type="text"
								list="communication-style-options"
								bind:value={editableCommunicationStyle}
								onfocus={showDatalist}
								class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
								maxlength="200"
							/>
							<datalist id="communication-style-options">
								<option value="Direct">Direct</option>
								<option value="Technical/Jargon use">Technical/Jargon use</option>
								<option value="Informal">Informal</option>
								<option value="Philosophical">Philosophical</option>
								<option value="Pragmatic">Pragmatic</option>
								<option value="Conversational">Conversational</option>
							</datalist>
							<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<label for="goal-in-debate" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Goal in the Debate
						</label>
						<div class="relative">
							<input
								id="goal-in-debate"
								type="text"
								list="goal-in-debate-options"
								bind:value={editableGoalInDebate}
								onfocus={showDatalist}
								class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
								maxlength="300"
							/>
							<datalist id="goal-in-debate-options">
								<option value="Keep discussion grounded">Keep discussion grounded</option>
								<option value="Explain complexity">Explain complexity</option>
								<option value="Advocate for change">Advocate for change</option>
								<option value="Defend current system">Defend current system</option>
								<option value="Find compromise">Find compromise</option>
							</datalist>
							<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
						</div>
					</div>
				</div>
			</div>

			<!-- Group 4: Demographics -->
			<div>
				<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Demographics</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
					<div class="flex flex-col gap-2">
						<label for="income-bracket" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Income Bracket
						</label>
						<div class="relative">
							<input
								id="income-bracket"
								type="text"
								list="income-bracket-options"
								bind:value={editableIncomeBracket}
								onfocus={showDatalist}
								class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
								maxlength="100"
							/>
							<datalist id="income-bracket-options">
								<option value="Low">Low</option>
								<option value="Middle">Middle</option>
								<option value="High">High</option>
								<option value="Comfortable">Comfortable</option>
								<option value="Struggling">Struggling</option>
							</datalist>
							<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<label for="political-leanings" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Political Leanings
						</label>
						<div class="relative">
							<input
								id="political-leanings"
								type="text"
								list="political-leanings-options"
								bind:value={editablePoliticalLeanings}
								onfocus={showDatalist}
								class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
								maxlength="100"
							/>
							<datalist id="political-leanings-options">
								<option value="Liberal">Liberal</option>
								<option value="Conservative">Conservative</option>
								<option value="Moderate">Moderate</option>
								<option value="Libertarian">Libertarian</option>
								<option value="Non-affiliated">Non-affiliated</option>
								<option value="Progressive">Progressive</option>
							</datalist>
							<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<label for="geographic-context" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Geographic Context
						</label>
						<div class="relative">
							<input
								id="geographic-context"
								type="text"
								list="geographic-context-options"
								bind:value={editableGeographicContext}
								onfocus={showDatalist}
								class="peer w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 pr-9 text-sm transition-colors focus:bg-white focus:outline-none dark:border-gray-600 dark:focus:bg-gray-900"
								maxlength="100"
							/>
							<datalist id="geographic-context-options">
								<option value="Rural">Rural</option>
								<option value="Urban">Urban</option>
								<option value="Suburban">Suburban</option>
							</datalist>
							<CarbonEdit class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-50 transition-opacity peer-focus:opacity-0 dark:text-gray-500" />
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Sticky buttons -->
		<div
			class="sticky bottom-0 flex flex-wrap gap-2 py-4"
		>
			<button
				class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				onclick={togglePersona}
			>
				{$settings.activePersonas.includes(selectedPersona.id) ? "Deactivate" : "Activate"}
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


