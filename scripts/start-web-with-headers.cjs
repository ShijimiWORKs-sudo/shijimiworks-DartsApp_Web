/* global __dirname */

const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_WEB_PORT = 8081;
const ISOLATION_HEADERS = {
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

function parseWebArgs(argv) {
  const expoArgs = [];
  let externalPort = DEFAULT_WEB_PORT;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--port' || arg === '-p') {
      externalPort = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--port=')) {
      externalPort = Number(arg.slice('--port='.length));
      continue;
    }

    expoArgs.push(arg);
  }

  if (!Number.isInteger(externalPort) || externalPort < 1 || externalPort > 65535) {
    throw new Error(`Invalid web port: ${externalPort}`);
  }

  return { externalPort, expoArgs };
}

function applyIsolationHeaders(headers = {}) {
  return {
    ...headers,
    ...ISOLATION_HEADERS,
  };
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findInternalPort(externalPort) {
  for (let port = externalPort + 1; port <= externalPort + 50 && port <= 65535; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`Unable to find an internal Expo port near ${externalPort}`);
}

function createProxyServer(targetPort) {
  const server = http.createServer((request, response) => {
    const proxyRequest = http.request(
      {
        hostname: '127.0.0.1',
        port: targetPort,
        path: request.url,
        method: request.method,
        headers: {
          ...request.headers,
          host: `localhost:${targetPort}`,
        },
      },
      (proxyResponse) => {
        response.writeHead(
          proxyResponse.statusCode ?? 502,
          proxyResponse.statusMessage,
          applyIsolationHeaders(proxyResponse.headers),
        );
        proxyResponse.pipe(response);
      },
    );

    proxyRequest.on('error', (error) => {
      response.writeHead(
        502,
        applyIsolationHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }),
      );
      response.end(`Expo web proxy failed: ${error.message}`);
    });

    request.pipe(proxyRequest);
  });

  server.on('upgrade', (request, socket, head) => {
    let upstream;

    socket.on('error', () => {
      upstream?.destroy();
    });

    upstream = net.connect(targetPort, '127.0.0.1', () => {
      upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`);

      const headers = {
        ...request.headers,
        host: `localhost:${targetPort}`,
      };

      for (const [name, value] of Object.entries(headers)) {
        upstream.write(`${name}: ${value}\r\n`);
      }

      upstream.write('\r\n');

      if (head.length > 0) {
        upstream.write(head);
      }

      upstream.pipe(socket);
      socket.pipe(upstream);
    });

    upstream.on('error', () => {
      socket.destroy();
    });
  });

  return server;
}

function spawnExpo(projectRoot, internalPort, expoArgs) {
  const expoBin = path.join(projectRoot, 'node_modules', 'expo', 'bin', 'cli');
  const child = spawn(
    process.execPath,
    [expoBin, 'start', '--web', '--port', String(internalPort), ...expoArgs],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  return child;
}

async function start(argv = process.argv.slice(2), projectRoot = path.resolve(__dirname, '..')) {
  const { externalPort, expoArgs } = parseWebArgs(argv);
  const internalPort = await findInternalPort(externalPort);
  const proxyServer = createProxyServer(internalPort);
  const expoProcess = spawnExpo(projectRoot, internalPort, expoArgs);

  await new Promise((resolve, reject) => {
    proxyServer.once('error', reject);
    proxyServer.listen(externalPort, () => resolve());
  });

  console.log(
    `DartsApp web proxy listening on http://localhost:${externalPort} with COEP/COOP headers.`,
  );
  console.log(`Expo web dev server is running internally on http://localhost:${internalPort}.`);

  const shutdown = () => {
    proxyServer.close();
    if (!expoProcess.killed) {
      expoProcess.kill();
    }
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  expoProcess.once('exit', (code) => {
    proxyServer.close(() => {
      process.exit(code ?? 0);
    });
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  ISOLATION_HEADERS,
  applyIsolationHeaders,
  parseWebArgs,
};
