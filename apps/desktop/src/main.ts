import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage } from 'electron';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { OurStageProject } from '@our-stage/project-schema';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ourstage-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
const allowedAssetRoots = new Set<string>();
let dataRoot = '';
let autosavePath = '';
let recentPath = '';
let credentialsPath = '';

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assetUrl(filePath: string): string {
  const resolved = path.resolve(filePath);
  const root = path.dirname(resolved);
  allowedAssetRoots.add(root);
  const token = Buffer.from(root, 'utf8').toString('base64url');
  const fileName = encodeURIComponent(path.basename(resolved));
  return `ourstage-asset://local/${token}/${fileName}`;
}

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function describeFile(filePath: string, type: string) {
  const resolved = path.resolve(filePath);
  const info = await stat(resolved);
  if (!info.isFile()) throw new Error('Only files can be imported.');
  const hash = await hashFile(resolved);
  return {
    assetId: hash,
    name: path.basename(resolved),
    path: assetUrl(resolved),
    sourcePath: resolved,
    size: info.size,
    type,
  };
}

async function ensureDataDirectories(): Promise<void> {
  dataRoot = path.join(app.getPath('userData'), 'OurStageData');
  autosavePath = path.join(dataRoot, 'projects', 'autosave.ourstage');
  recentPath = path.join(dataRoot, 'recent-projects.json');
  credentialsPath = path.join(dataRoot, 'credentials.json');
  await Promise.all([
    mkdir(path.join(dataRoot, 'library', 'models'), { recursive: true }),
    mkdir(path.join(dataRoot, 'library', 'motions'), { recursive: true }),
    mkdir(path.join(dataRoot, 'library', 'audio'), { recursive: true }),
    mkdir(path.join(dataRoot, 'projects'), { recursive: true }),
    mkdir(path.join(dataRoot, 'exports'), { recursive: true }),
    mkdir(path.join(dataRoot, 'cache'), { recursive: true }),
    mkdir(path.join(dataRoot, 'logs'), { recursive: true }),
  ]);
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function addRecent(project: OurStageProject, filePath: string): Promise<void> {
  const recent = await readJson<Array<{ name: string; path: string; updatedAt: string }>>(recentPath, []);
  const next = [
    { name: project.metadata.name, path: filePath, updatedAt: new Date().toISOString() },
    ...recent.filter((item) => item.path !== filePath),
  ].slice(0, 12);
  await writeFile(recentPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#120f18',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.OUR_STAGE_DEV_URL;
    if (devUrl && url.startsWith(devUrl)) return;
    if (url.startsWith('file://')) return;
    event.preventDefault();
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
      const segments = url.pathname.split('/').filter(Boolean);
      const token = segments.shift();
      if (!token || segments.length === 0) return new Response('Invalid asset URL.', { status: 400 });
      const root = Buffer.from(token, 'base64url').toString('utf8');
      const relativePath = segments.map((segment) => decodeURIComponent(segment)).join(path.sep);
      const resolvedRoot = path.resolve(root);
      const resolved = path.resolve(resolvedRoot, relativePath);
      if (!allowedAssetRoots.has(resolvedRoot) || !isInside(resolvedRoot, resolved)) {
        return new Response('Asset path is not authorised.', { status: 403 });
      }
      return net.fetch(pathToFileURL(resolved).toString());
    } catch {
      return new Response('Invalid asset URL.', { status: 400 });
    }
  });
}

function registerIpc(): void {
  ipcMain.handle('asset:import-model', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'MMD Model', extensions: ['pmx', 'pmd'] }],
    });
    return result.canceled || !result.filePaths[0]
      ? null
      : describeFile(result.filePaths[0], 'pmx-model');
  });
  ipcMain.handle('asset:import-motion', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'MMD Motion', extensions: ['vmd'] }],
    });
    return result.canceled || !result.filePaths[0]
      ? null
      : describeFile(result.filePaths[0], 'vmd-motion');
  });
  ipcMain.handle('asset:import-audio', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }],
    });
    return result.canceled || !result.filePaths[0]
      ? null
      : describeFile(result.filePaths[0], 'audio');
  });
  ipcMain.handle('asset:resolve', async (_event, sourcePath: string) => {
    const resolved = path.resolve(sourcePath);
    const info = await stat(resolved).catch(() => null);
    return info?.isFile() ? assetUrl(resolved) : null;
  });
  ipcMain.handle('project:load', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Our Stage Project', extensions: ['ourstage', 'json'] }],
    });
    if (result.canceled || !result.filePaths[0]) {
      const autosave = await readJson<OurStageProject | null>(autosavePath, null);
      return autosave;
    }
    const project = JSON.parse(await readFile(result.filePaths[0], 'utf8')) as OurStageProject;
    await addRecent(project, result.filePaths[0]);
    return project;
  });
  ipcMain.handle('project:save', async (_event, project: OurStageProject) => {
    const result = await dialog.showSaveDialog({
      defaultPath: `${project.metadata.name.replace(/[^a-z0-9-_]+/gi, '-')}.ourstage`,
      filters: [{ name: 'Our Stage Project', extensions: ['ourstage'] }],
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
    await addRecent(project, result.filePath);
    return result.filePath;
  });
  ipcMain.handle('project:autosave', async (_event, project: OurStageProject) => {
    await writeFile(autosavePath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  });
  ipcMain.handle('project:recent', () =>
    readJson<Array<{ name: string; path: string; updatedAt: string }>>(recentPath, []),
  );
  ipcMain.handle('credential:set', async (_event, provider: string, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const credentials = await readJson<Record<string, string>>(credentialsPath, {});
    credentials[provider] = safeStorage.encryptString(value).toString('base64');
    await writeFile(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, 'utf8');
    return true;
  });
  ipcMain.handle('credential:has', async (_event, provider: string) => {
    const credentials = await readJson<Record<string, string>>(credentialsPath, {});
    return Boolean(credentials[provider]);
  });
}

app.whenReady().then(async () => {
  await ensureDataDirectories();
  registerAssetProtocol();
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
