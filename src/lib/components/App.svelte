<script lang="ts">
	import { onMount } from 'svelte';
	import { initGame, newRun, run, save } from '../stores/game';
	import HowToPlay from './HowToPlay.svelte';
	import ResearchLab from './ResearchLab.svelte';
	import RunScreen from './RunScreen.svelte';
	import SettingsScreen from './SettingsScreen.svelte';
	import TitleScreen from './TitleScreen.svelte';

	type View = 'title' | 'run' | 'research' | 'settings' | 'howto';

	let view = $state<View>('title');

	onMount(() => {
		initGame();
	});

	const reduceMotion = $derived($save.settings.reduceMotion);

	function startNewRun(): void {
		newRun();
		view = 'run';
	}
</script>

<div class="app-root" class:reduce-motion={reduceMotion}>
	{#if view === 'run' && $run}
		<RunScreen onMenu={() => (view = 'title')} />
	{:else if view === 'research'}
		<ResearchLab onBack={() => (view = 'title')} />
	{:else if view === 'settings'}
		<SettingsScreen onBack={() => (view = 'title')} />
	{:else if view === 'howto'}
		<HowToPlay onBack={() => (view = 'title')} />
	{:else}
		<TitleScreen
			onContinue={() => (view = 'run')}
			onNewRun={startNewRun}
			onResearch={() => (view = 'research')}
			onSettings={() => (view = 'settings')}
			onHowTo={() => (view = 'howto')}
		/>
	{/if}
</div>
