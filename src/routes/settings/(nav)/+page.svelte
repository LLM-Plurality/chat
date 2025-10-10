<script lang="ts">
    import { browser } from "$app/environment";
    import { base } from "$app/paths";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { isDesktop } from "$lib/utils/isDesktop";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    onMount(() => {
        // On desktop, redirect to application settings
        if (browser && isDesktop(window)) {
            goto(`${base}/settings/application`, { replaceState: true });
        }
    });
</script>

<div class="flex h-full w-full items-center justify-center text-gray-500 dark:text-gray-400">
    {#if browser && isDesktop(window)}
        <p>Loading...</p>
    {:else}
        <p>Select a tab from above</p>
    {/if}
</div>

