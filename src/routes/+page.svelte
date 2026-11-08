<script lang="ts">
	import { onMount } from 'svelte';
	import RunScreen from '../lib/components/RunScreen.svelte';
	import { initGame } from '../lib/stores/game';

	onMount(() => {
		initGame();
	});
</script>

<RunScreen />
