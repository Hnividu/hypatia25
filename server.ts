
import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
// import { SocketServer } from './src/lib/socket/server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all interfaces
const port = parseInt(process.env.PORT || '3000', 10);
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(async () => {
    const httpServer = createServer(handler);

    const io = new Server(httpServer, {
        path: '/api/socketio',
        addTrailingSlash: false,
        cors: {
            origin: [
                'http://localhost:3000',
                process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
            ],
            methods: ['GET', 'POST'],
        },
    });

    // Initialize the socket server logic
    // Dynamic import to avoid loading Next.js helpers (like cookies) before app is prepared
    const { SocketServer } = await import('./src/lib/socket/server');
    new SocketServer(io);

    httpServer
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
