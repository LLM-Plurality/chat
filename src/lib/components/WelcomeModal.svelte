<script lang="ts">
	import Modal from "$lib/components/Modal.svelte";
	import IconOmni from "$lib/components/icons/IconOmni.svelte";
	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";

	const publicConfig = usePublicConfig();

	interface Props {
		close: () => void;
	}

	let { close }: Props = $props();
</script>
