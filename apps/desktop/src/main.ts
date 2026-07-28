import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage } from 'electron';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

protocol.registerSchemesAsPrivileged([
  { scheme: 'ourstage-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
const allowedAssetRoots = new Set<string>();

function assetUrl(filePath: string): string {
  const encoded = Buffer.from(path.resolve(filePath), 'utf8').toString('base64url');
  return `ourstage-asset://local/${encoded}`;
}

async function describeFile(filePath: string, type: string) {
  const info = await stat(filePath);
  const hash = createHash('sha256').update(await readFile(filePath)).digest('hex');
  allowedAssetRoots.add(path.dirname(path.resolve(filePath)));
  return { assetId: hash, name: path.basename(filePath), path: assetUrl(filePath), size: info.size, type };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#120f18',
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  const devUrl = process.env.OUR_STAGE_DEV_URL;
  if (devUrl) void mainWindow.loadURL(devUrl);
  else void mainWindow.loadFile(path.join(__dirname, '../../editor/dist/index.html'));
}

function registerAssetProtocol(): void {
  protocol.handle('ourstage-asset', (request) => {
    try {
      const url = new URL(request.url);
      const encoded = url.pathname.slice(1);
      const filePath = Buffer.from(encoded, 'base64url').toString('utf8');
      const resolved = path.resolve(filePath);
      const allowed = [...allowedAssetRoots].some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
      if (!allowed) return new Response('Asset path is not authorised.', { status: 403 });
      return net.fetch(pathToFileURL(resolved).toString());
    } catch {
      return new Response('Invalid asset URL.', { status: 400 });
    }
  });
}

function registerIpc(): void {
  ipcMain.handle('asset:import-model', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'MMD Model', extensions: ['pmx', 'pmd'] }] });
    return result.canceled || !result.filePaths[0] ? null : describeFile(result.filePaths[0], 'pmx-model');
  });
  ipcMain.handle('asset:import-motion', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'MMD Motion', extensions: ['vmd'] }] });
    return result.canceled || !result.filePaths[0] ? null : describeFile(result.filePaths[0], 'vmd-motion');
  });
  ipcMain.handle('asset:import-audio', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }] });
    return result.canceled || !result.filePaths[0] ? null : describeFile(result.filePaths[0], 'audio');
  });
  ipcMain.handle('project:load', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Our Stage Project', extensions: ['ourstage', 'json'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    return JSON.parse(await readFile(result.filePaths[0], 'utf8')) as unknown;
  });
  ipcMain.handle('project:save', async (_event, project: unknown) => {
    const result = await dialog.showSaveDialog({ defaultPath: 'project.ourstage', filters: [{ name: 'Our Stage Project', extensions: ['ourstage'] }] });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
    return result.filePath;
  });
  ipcMain.handle('credential:set', (_event, value: string) => safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(value).toString('base64') : null);
}

app.whenReady().then(() => {
  registerAssetProtocol();
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
