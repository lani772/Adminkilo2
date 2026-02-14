import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeDatabase } from './src/db';
import { wsManager } from './src/lib/websocket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Force development mode for bun dev
const isDev = dev || process.argv.includes('dev');

const app = next({ dev: isDev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  try {
    console.log('🚀 Starting Advanced Admin Control Panel...\n');

    // Initialize database
    await initializeDatabase();
    console.log('');

    // Prepare Next.js app
    await app.prepare();
    console.log('✅ Next.js app prepared\n');

    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });

    // Initialize WebSocket server
    wsManager.initialize(server);
    console.log('');

    // Start listening
    server.listen(port, () => {
      console.log('┌─────────────────────────────────────────────────────────┐');
      console.log('│                                                         │');
      console.log('│   🎛️  Advanced Admin Control Panel                     │');
      console.log('│                                                         │');
      console.log('│   ✅ Server running at:                                 │');
      console.log(`│      http://${hostname}:${port}                              │`);
      console.log('│                                                         │');
      console.log('│   🔐 Admin Login:                                       │');
      console.log(`│      http://${hostname}:${port}/admin/login                  │`);
      console.log('│                                                         │');
      console.log('│   📚 Default Credentials:                               │');
      console.log('│      Username: admin                                    │');
      console.log('│      Password: admin123                                 │');
      console.log('│                                                         │');
      console.log('│   🌐 WebSocket:                                         │');
      console.log(`│      ws://${hostname}:${port}?token=YOUR_JWT_TOKEN           │`);
      console.log('│                                                         │');
      console.log('│   📖 API Documentation:                                 │');
      console.log('│      See API_DOCUMENTATION.md                           │');
      console.log('│                                                         │');
      console.log('└─────────────────────────────────────────────────────────┘');
      console.log('');
      console.log('💡 Press Ctrl+C to stop the server\n');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\n🛑 SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('\n\n🛑 SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();
