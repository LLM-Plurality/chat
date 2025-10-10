<script lang="ts">
    import { browser } from "$app/environment";
    import { base } from "$app/paths";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { useSettingsStore } from "$lib/stores/settings";
    import { isDesktop } from "$lib/utils/isDesktop";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    const settings = useSettingsStore();

    onMount(() => {
        // On desktop, redirect to the active model or first model
        if (browser && isDesktop(window)) {
            const targetId = $settings.activeModel || data.models[0]?.id || "";
            if (targetId) {
                goto(`${base}/settings/models/${targetId}`, { replaceState: true });
            }
        }
    });
</script>

<div class="flex h-full w-full items-center justify-center text-gray-500 dark:text-gray-400">
    {#if browser && isDesktop(window)}
        <p>Loading...</p>
    {:else}
        <p>Select a model from the list</p>
    {/if}
</div>

