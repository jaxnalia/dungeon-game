import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { DungeonGenerator } from '../lib/game/DungeonGenerator';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Game state
const gameState = {
    players: new Map<string, any>(),
    dungeon: null as any,
    lastUpdate: Date.now()
};

// Generate dungeon on server start
const dungeonGenerator = new DungeonGenerator();
gameState.dungeon = dungeonGenerator.generateDungeon();

// Serve static files
app.use(express.static('dist'));

// Handle socket connections
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Send initial game state to new player
    socket.emit('gameState', {
        dungeon: gameState.dungeon,
        players: Array.from(gameState.players.values())
    });

    // Handle player updates
    socket.on('playerUpdate', (playerData) => {
        gameState.players.set(socket.id, {
            ...playerData,
            id: socket.id,
            lastUpdate: Date.now()
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        gameState.players.delete(socket.id);
        io.emit('playerDisconnected', socket.id);
    });
});

// Broadcast game state to all players
setInterval(() => {
    const currentTime = Date.now();
    const players = Array.from(gameState.players.values())
        .filter(player => currentTime - player.lastUpdate < 5000); // Remove players that haven't updated in 5 seconds
    
    io.emit('gameState', {
        players,
        lastUpdate: currentTime
    });
}, 1000 / 20); // 20 updates per second

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 