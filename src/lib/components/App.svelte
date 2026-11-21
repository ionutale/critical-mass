<script lang="ts">
	import { onMount } from 'svelte';
	import { setSoundEnabled } from '../game/sound';
	import { initGame, newRun, run, save } from '../stores/arcade';
	import { reducedMotion } from '../stores/motion';
	import HowToPlay from './arcade/HowToPlay.svelte';
	import RunScreen from './arcade/RunScreen.svelte';
	import SettingsScreen from './arcade/SettingsScreen.svelte';
	import TitleScreen from './arcade/TitleScreen.svelte';
	import UnlocksScreen from './arcade/UnlocksScreen.svelte';

	type View = 'title' | 'run' | 'unlocks' | 'howto' | 'settings';

	let view = $state<View>('title');
	// The saved Reduce Motion setting only exists after initGame(), which runs
	// on mount. Gate the first paint so a returning reduced-motion player never
	// sees the title entrance; later view changes animate normally.
	let hydrated = $state(false);

	onMount(() => {
		initGame();
		hydrated = true;
	});

	$effect(() => {
		setSoundEnabled($save.settings.sound);
	});

	function startNewRun(): void {
		newRun();
		view = 'run';
	}
</script>

<div class="app-root" class:reduce-motion={!hydrated || $reducedMotion}>
	{#key view}
		{#if view === 'run' && $run}
			<RunScreen onMenu={() => (view = 'title')} />
		{:else if view === 'unlocks'}
			<UnlocksScreen onBack={() => (view = 'title')} />
		{:else if view === 'settings'}
			<SettingsScreen onBack={() => (view = 'title')} />
		{:else if view === 'howto'}
			<HowToPlay onBack={() => (view = 'title')} />
		{:else}
			<TitleScreen
				{hydrated}
				onPlay={startNewRun}
				onContinue={() => (view = 'run')}
				onUnlocks={() => (view = 'unlocks')}
				onSettings={() => (view = 'settings')}
				onHowTo={() => (view = 'howto')}
			/>
		{/if}
	{/key}
</div>
