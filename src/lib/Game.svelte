<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { GameScene } from './game/Scene';

    let container: HTMLDivElement;
    let gameScene: GameScene;

    onMount(() => {
        gameScene = new GameScene(container);

        const handleResize = () => {
            if (container) {
                gameScene.resize(container.clientWidth, container.clientHeight);
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
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