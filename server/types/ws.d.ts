declare module 'ws' {
    import { EventEmitter } from 'events';
    import { Server as NetServer } from 'net';

    class WebSocket extends EventEmitter {
        constructor(address: string | URL, options?: any);
        send(data: any, options?: any, cb?: (err?: Error) => void): void;
        close(code?: number, reason?: string): void;
        readyState: number;
    }

    namespace WebSocket {
        const OPEN: number;
        const CLOSED: number;
    }

    class WebSocketServer extends EventEmitter {
        constructor(options: { port: number });
        clients: Set<WebSocket>;
    }

    export { WebSocket, WebSocketServer };
} 