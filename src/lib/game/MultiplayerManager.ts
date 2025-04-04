import * as THREE from 'three';
import { Player } from './Player';
import { UI } from './UI';
import { GameScene } from './Scene';

export class MultiplayerManager {
    private gameScene: GameScene;
    private ui: UI;
    private socket: WebSocket | null = null;
    private players: Map<string, THREE.Mesh> = new Map();
    private playerId: string | null = null;
    private keepAliveInterval: number | null = null;
    private lastMessageTime: number = Date.now();

    constructor(gameScene: GameScene, ui: UI) {
        console.log('MultiplayerManager: Initializing...');
        this.gameScene = gameScene;
        this.ui = ui;
    }

    public connect(ip: string, port: number) {
        console.log('MultiplayerManager: Attempting to connect to', ip, port);
        try {
            // Try different connection strategies
            this.tryConnect(ip, port);
        } catch (error) {
            console.error('MultiplayerManager: Failed to connect:', error);
            this.ui.showMessage('Failed to connect to server');
        }
    }

    private tryConnect(ip: string, port: number, attempt = 1) {
        console.log(`MultiplayerManager: Connection attempt ${attempt}`);
        
        // Strategy 1: Direct ws:// connection
        if (attempt === 1) {
            const protocol = 'ws://';
            const wsUrl = `${protocol}${ip}:${port}`;
            console.log('MultiplayerManager: Trying direct ws:// connection to', wsUrl);
            this.createWebSocket(wsUrl, ip, port, attempt);
        }
        // Strategy 2: Try with IP address if domain was used
        else if (attempt === 2 && ip.includes('.')) {
            // If it's a domain, try to resolve it to an IP
            console.log('MultiplayerManager: Trying to resolve domain to IP');
            this.resolveDomainToIP(ip, port, attempt);
        }
        // Strategy 3: Try with a different port format
        else if (attempt === 3) {
            const protocol = 'ws://';
            const wsUrl = `${protocol}${ip}:${port}/ws`;
            console.log('MultiplayerManager: Trying with path /ws to', wsUrl);
            this.createWebSocket(wsUrl, ip, port, attempt);
        }
        // Strategy 4: Try with a different protocol format
        else if (attempt === 4) {
            const wsUrl = `ws://${ip}:${port}`;
            console.log('MultiplayerManager: Trying with explicit protocol to', wsUrl);
            this.createWebSocket(wsUrl, ip, port, attempt);
        }
        // If all attempts fail, show an error message
        else {
            console.error('MultiplayerManager: All connection attempts failed');
            this.ui.showMessage('Failed to connect to server after multiple attempts');
        }
    }

    private resolveDomainToIP(domain: string, port: number, attempt: number) {
        // This is a simplified approach - in a real app, you might use a DNS resolver
        // For now, we'll just try with the domain as is
        this.tryConnect(domain, port, attempt + 1);
    }

    private createWebSocket(wsUrl: string, ip: string, port: number, attempt: number) {
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('MultiplayerManager: WebSocket connection established');
                this.ui.showMessage('Connected to server');
                this.startKeepAlive();
            };

            this.socket.onmessage = (event) => {
                console.log('MultiplayerManager: Received message:', event.data);
                this.lastMessageTime = Date.now();
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };

            this.socket.onclose = (event) => {
                console.log('MultiplayerManager: WebSocket connection closed', event.code, event.reason);
                this.stopKeepAlive();
                this.ui.showMessage(`Disconnected from server: ${event.reason || 'Connection closed'}`);
                this.players.clear();
                
                // Try next connection strategy
                if (attempt < 4) {
                    console.log('MultiplayerManager: Trying next connection strategy...');
                    setTimeout(() => {
                        this.tryConnect(ip, port, attempt + 1);
                    }, 1000);
                } else {
                    // After all attempts, try to reconnect with the original strategy
                    setTimeout(() => {
                        console.log('MultiplayerManager: Attempting to reconnect with original strategy...');
                        this.tryConnect(ip, port, 1);
                    }, 5000);
                }
            };

            this.socket.onerror = (error) => {
                console.error('MultiplayerManager: WebSocket error:', error);
                this.stopKeepAlive();
                this.ui.showMessage('Connection error - Check console for details');
            };
        } catch (error) {
            console.error('MultiplayerManager: Error creating WebSocket:', error);
            // Try next connection strategy
            if (attempt < 4) {
                console.log('MultiplayerManager: Trying next connection strategy...');
                setTimeout(() => {
                    this.tryConnect(ip, port, attempt + 1);
                }, 1000);
            }
        }
    }

    private startKeepAlive() {
        // Send keep-alive every 10 seconds
        this.keepAliveInterval = window.setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'ping'
                }));
                console.log('MultiplayerManager: Sent keep-alive ping');
            }
        }, 10000);

        // Check for timeout every 5 seconds
        setInterval(() => {
            if (Date.now() - this.lastMessageTime > 30000) {
                console.log('MultiplayerManager: Connection timeout detected');
                if (this.socket) {
                    this.socket.close();
                }
            }
        }, 5000);
    }

    private stopKeepAlive() {
        if (this.keepAliveInterval !== null) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }

    private handleMessage(data: any) {
        console.log('MultiplayerManager: Handling message type:', data.type);
        switch (data.type) {
            case 'init':
                console.log('MultiplayerManager: Received init message');
                this.playerId = data.data.playerId;
                this.gameScene.createDungeonFromData(data.data.dungeon);
                // Add existing players
                data.data.players.forEach((player: any) => {
                    if (player.id !== this.playerId) {
                        this.addPlayer(player);
                    }
                });
                break;
            case 'playerJoined':
                console.log('MultiplayerManager: Adding player:', data.data);
                this.addPlayer(data.data);
                break;
            case 'playerLeft':
                console.log('MultiplayerManager: Removing player:', data.data.id);
                this.removePlayer(data.data.id);
                break;
            case 'playerMoved':
                console.log('MultiplayerManager: Updating player position:', data.data);
                this.updatePlayer(data.data);
                break;
            case 'pong':
                console.log('MultiplayerManager: Received pong');
                break;
        }
    }

    private addPlayer(playerData: any) {
        if (this.players.has(playerData.id)) return;
        
        // Skip rendering the local player as it's already rendered by the Scene
        if (playerData.id === this.playerId) {
            console.log('MultiplayerManager: Skipping local player rendering');
            this.ui.showMessage('You joined the game');
            return;
        }

        const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        const material = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
        mesh.rotation.set(playerData.rotation.x, playerData.rotation.y, playerData.rotation.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.players.set(playerData.id, mesh);
        this.gameScene.scene.add(mesh);
        this.ui.showMessage(`Player ${playerData.id} joined`);
    }

    private removePlayer(playerId: string) {
        const player = this.players.get(playerId);
        if (player) {
            this.gameScene.scene.remove(player);
            this.players.delete(playerId);
            this.ui.showMessage(`Player ${playerId} left`);
        }
    }

    private updatePlayer(playerData: any) {
        const player = this.players.get(playerData.id);
        if (player) {
            player.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
            player.rotation.set(playerData.rotation.x, playerData.rotation.y, playerData.rotation.z);
        }
    }

    public updatePlayerPosition(position: THREE.Vector3, rotation: THREE.Euler) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'move',
                data: {
                    position: {
                        x: position.x,
                        y: position.y,
                        z: position.z
                    },
                    rotation: {
                        x: rotation.x,
                        y: rotation.y,
                        z: rotation.z
                    }
                }
            };
            console.log('MultiplayerManager: Sending position update:', message);
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('MultiplayerManager: Cannot send position update - socket not open');
        }
    }

    public cleanup() {
        if (this.socket) {
            this.socket.close();
        }
        this.players.forEach(player => {
            this.gameScene.scene.remove(player);
        });
        this.players.clear();
    }
} 