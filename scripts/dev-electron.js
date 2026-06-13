const waitOn = require('wait-on');
const { spawn, execSync } = require('child_process');
const path = require('path');
const net = require('net');

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function main() {
  const cwd = path.resolve(__dirname, '..');
  const port = 5173;
  const viteUrl = `http://localhost:${port}`;

  const inUse = await isPortInUse(port);
  if (inUse) {
    console.log(`[electron-dev] Port ${port} is in use, skipping wait...`);
  } else {
    console.log(`[electron-dev] Waiting for Vite on ${viteUrl}...`);
    await waitOn({
      resources: [`tcp:localhost:${port}`],
      timeout: 30000,
      log: true,
    });
    console.log('[electron-dev] Vite is ready.');
  }

  console.log('[electron-dev] Launching Electron...');

  const env = {
    ...process.env,
    VITE_DEV_SERVER_URL: viteUrl,
  };

  const electronExeName = process.platform === 'win32' ? 'electron.exe' : 'electron';
  const electronPath = path.resolve(cwd, 'node_modules', 'electron', 'dist', electronExeName);

  const electronProc = spawn(
    electronPath,
    ['.'],
    { cwd, env, stdio: 'inherit' }
  );

  electronProc.on('close', (code) => {
    console.log(`[electron-dev] Electron exited with code ${code}`);
    process.exit(code || 0);
  });

  electronProc.on('error', (err) => {
    console.error('[electron-dev] Failed to launch Electron:', err.message);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('[electron-dev] Error:', err.message);
  process.exit(1);
});
