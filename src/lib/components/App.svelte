<script lang="ts">
	import { onMount } from 'svelte';
	import { initGame, newRun, run, save } from '../stores/game';
	import { setSoundEnabled } from '../game/sound';
	import { reducedMotion } from '../stores/motion';
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

	$effect(() => {
		setSoundEnabled($save.settings.sound);
	});

	function startNewRun(): void {
		newRun();
		view = 'run';
	}
</script>

<div class="app-root" class:reduce-motion={$reducedMotion}>
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
