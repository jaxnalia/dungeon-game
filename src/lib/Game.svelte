<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Game } from './game';

    let container: HTMLDivElement;
    let game: Game;

    onMount(() => {
        console.log('Game.svelte: Mounting game...');
        game = new Game(container);

        const handleResize = () => {
            if (container) {
                game.scene.resize(container.clientWidth, container.clientHeight);
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    });

    onDestroy(() => {
        console.log('Game.svelte: Cleaning up game...');
        if (game) {
            game.cleanup();
        }
    });
</script>

<div class="game-container" bind:this={container}>
</div>

<style>
    .game-container {
        width: 100%;
        height: 100vh;
        background: #000;
    }
</style>