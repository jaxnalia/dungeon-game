import { GameScene } from './Scene';
import { ConnectionScreen } from './ConnectionScreen';

export class Game {
    public scene: GameScene;
    private connectionScreen: ConnectionScreen;
    private container: HTMLElement;

    constructor(container: HTMLElement) {
        console.log('Game: Initializing...');
        this.container = container;
        this.scene = new GameScene(container);
        this.connectionScreen = new ConnectionScreen(container, (ip: string, port: number) => {
            console.log('Game: Connection requested to', ip, port);
            this.connectToServer(ip, port);
        });
    }

    private connectToServer(ip: string, port: number) {
        console.log('Game: Starting server connection process...');
        
        // Hide connection screen
        this.connectionScreen.hide();
        console.log('Game: Connection screen hidden');

        // Initialize the game
        console.log('Game: Initializing game scene...');
        this.scene.initializeGame();
        console.log('Game: Game scene initialized');

        // Connect to server
        console.log('Game: Connecting to server...');
        this.scene.multiplayerManager.connect(ip, port);
        console.log('Game: Server connection initiated');
    }

    public cleanup() {
        this.scene.cleanup();
    }
} 