<script lang="ts">
	import { createParticles } from '../game/particles';

	let {
		seed = 1,
		burst = 0,
		mode = 'fusion',
		reducedMotion = false
	}: {
		seed?: number;
		burst?: number;
		mode?: 'fusion' | 'meltdown';
		reducedMotion?: boolean;
	} = $props();

	let canvas = $state<HTMLCanvasElement | undefined>();
	const colours = ['#38e1ff', '#ff4fd8', '#ffb347', '#b6ff5c'];

	$effect(() => {
		if (reducedMotion || !canvas) return;

		let ctx: CanvasRenderingContext2D | null = null;
		try {
			ctx = canvas.getContext('2d');
		} catch {
			return;
		}
		if (!ctx) return;

		const particles = createParticles(seed + burst, mode === 'meltdown' ? 70 : 38);
		const started = performance.now();
		let frame = 0;

		function draw(now: number): void {
			const element = canvas;
			if (!element || !ctx) return;
			const rect = element.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) return;

			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			element.width = Math.round(rect.width * ratio);
			element.height = Math.round(rect.height * ratio);
			ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
			ctx.clearRect(0, 0, rect.width, rect.height);

			const elapsed = (now - started) / 1000;
			if (elapsed > 1.6) {
				ctx.clearRect(0, 0, rect.width, rect.height);
				return;
			}

			const cx = rect.width / 2;
			const cy = rect.height / 2;
			const scale = Math.min(rect.width, rect.height) * 0.55;

			for (const particle of particles) {
				const age = elapsed / particle.life;
				if (age >= 1) continue;
				const x = cx + (particle.x - 0.5 + particle.vx * elapsed) * scale * 2;
				const y =
					cy + (particle.y - 0.5 + particle.vy * elapsed + 0.12 * elapsed * elapsed) * scale;
				ctx.globalAlpha = 1 - age;
				ctx.fillStyle = colours[particle.hue];
				ctx.beginPath();
				ctx.arc(x, y, particle.size, 0, Math.PI * 2);
				ctx.fill();
			}

			ctx.globalAlpha = 1;
			frame = requestAnimationFrame(draw);
		}

		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	});
</script>

{#if !reducedMotion}
	<canvas
		class="particles"
		class:meltdown={mode === 'meltdown'}
		bind:this={canvas}
		aria-hidden="true"
	></canvas>
{/if}

<style>
	.particles {
		position: fixed;
		z-index: 30;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.particles.meltdown {
		z-index: 45;
	}
</style>
