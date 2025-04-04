import { WebSocketServer, WebSocket } from 'ws';
import { DungeonGenerator } from './DungeonGenerator';

interface Player {
    id: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    lastUpdate: number;
}

interface MoveMessage {
    type: 'move';
    data: {
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
    };
}

interface PlayerJoinedMessage {
    type: 'playerJoined';
    data: Player;
}

interface PlayerMovedMessage {
    type: 'playerMoved';
    data: {
        id: string;
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
    };
}

interface PlayerLeftMessage {
    type: 'playerLeft';
    data: {
        id: string;
    };
}

interface InitMessage {
    type: 'init';
    data: {
        playerId: string;
        dungeon: {
            rooms: Room[];
            hallways: Hallway[];
        };
        players: Player[];
    };
}

interface PingMessage {
    type: 'ping';
}

type Message = MoveMessage | PlayerJoinedMessage | PlayerMovedMessage | PlayerLeftMessage | InitMessage | PingMessage;

interface Room {
    x: number;
    y: number;
    z: number;
    size: number;
    height: number;
    walls: {
        north: boolean;
        south: boolean;
        east: boolean;
        west: boolean;
    };
    doors: {
        north: boolean;
        south: boolean;
        east: boolean;
        west: boolean;
    };
}

interface Hallway {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    depth: number;
    direction: 'horizontal' | 'vertical';
}

const wss = new WebSocketServer({ port: 8080 });
const players = new Map<string, Player>();
const generator = new DungeonGenerator();
const MOVE_RATE_LIMIT = 100; // milliseconds between move updates
const CONNECTION_TIMEOUT = 60000; // 60 seconds
const KEEP_ALIVE_INTERVAL = 10000; // 10 seconds

// Generate dungeon once for all clients
const { rooms, hallways } = generator.generateDungeon();

function findSafeSpawnPoint(): { x: number; y: number; z: number } {
    // Find the first room and spawn in its center
    if (rooms.length > 0) {
        const firstRoom = rooms[0];
        return {
            x: firstRoom.x + firstRoom.size / 2,
            y: 1.5, // Player height
            z: firstRoom.z + firstRoom.size / 2
        };
    }
    return { x: 0, y: 1.5, z: 0 }; // Fallback spawn point
}

function broadcast(message: Message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(message));
            } catch (error) {
                console.error('Error broadcasting message:', error);
            }
        }
    });
}

function validateMessage(message: any): message is Message {
    if (!message || typeof message !== 'object') return false;
    if (!message.type || typeof message.type !== 'string') return false;

    switch (message.type) {
        case 'move':
            if (!message.data || typeof message.data !== 'object') return false;
            const { position, rotation } = message.data;
            return (
                position && typeof position === 'object' &&
                typeof position.x === 'number' &&
                typeof position.y === 'number' &&
                typeof position.z === 'number' &&
                rotation && typeof rotation === 'object' &&
                typeof rotation.x === 'number' &&
                typeof rotation.y === 'number' &&
                typeof rotation.z === 'number'
            );
        case 'ping':
            return true;
        default:
            return false;
    }
}

wss.on('connection', (ws: WebSocket) => {
    console.log('New client connected');

    // Generate a unique ID for the player
    const playerId = Math.random().toString(36).substring(2, 15);
    
    // Create initial player data with safe spawn point
    const spawnPoint = findSafeSpawnPoint();
    const player: Player = {
        id: playerId,
        position: spawnPoint,
        rotation: { x: 0, y: 0, z: 0 },
        lastUpdate: Date.now()
    };
    
    players.set(playerId, player);

    // Set up connection timeout
    let timeout = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    }, CONNECTION_TIMEOUT);

    // Send initial data to the new client
    try {
        const initMessage: InitMessage = {
            type: 'init',
            data: {
                playerId,
                dungeon: {
                    rooms,
                    hallways
                },
                players: Array.from(players.values())
            }
        };
        ws.send(JSON.stringify(initMessage));
    } catch (error) {
        console.error('Error sending initial data:', error);
        ws.close();
        return;
    }

    // Broadcast new player to all clients
    const playerJoinedMessage: PlayerJoinedMessage = {
        type: 'playerJoined',
        data: player
    };
    broadcast(playerJoinedMessage);

    ws.on('message', (message: string) => {
        try {
            const data = JSON.parse(message);
            
            if (!validateMessage(data)) {
                console.warn('Invalid message received:', data);
                return;
            }

            // Reset timeout on any valid message
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            }, CONNECTION_TIMEOUT);

            if (data.type === 'ping') {
                // Respond to ping with pong
                ws.send(JSON.stringify({ type: 'pong' }));
                return;
            }

            const player = players.get(playerId);
            if (!player) {
                console.warn('Player not found:', playerId);
                return;
            }

            const now = Date.now();
            if (data.type === 'move') {
                // Rate limiting
                if (now - player.lastUpdate < MOVE_RATE_LIMIT) {
                    return;
                }
                player.lastUpdate = now;

                // Update player position and rotation
                player.position = data.data.position;
                player.rotation = data.data.rotation;

                // Broadcast the update
                const playerMovedMessage: PlayerMovedMessage = {
                    type: 'playerMoved',
                    data: { id: playerId, ...data.data }
                };
                broadcast(playerMovedMessage);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        clearTimeout(timeout);
        console.log('Client disconnected:', playerId);
        players.delete(playerId);
        const playerLeftMessage: PlayerLeftMessage = {
            type: 'playerLeft',
            data: { id: playerId }
        };
        broadcast(playerLeftMessage);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(timeout);
        players.delete(playerId);
    });
});

console.log('WebSocket server started on port 8080'); 