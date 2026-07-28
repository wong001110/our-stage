import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

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

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const devUrl = process.env.OUR_STAGE_DEV_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../editor/dist/index.html'));
  }
}

function registerIpc(): void {
  ipcMain.handle('project:load', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Our Stage Project', extensions: ['ourstage', 'json'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const content = await readFile(result.filePaths[0], 'utf8');
    return JSON.parse(content) as unknown;
  });

  ipcMain.handle('project:save', async (_event, project: unknown) => {
    const result = await dialog.showSaveDialog({
      defaultPath: 'project.ourstage',
      filters: [{ name: 'Our Stage Project', extensions: ['ourstage'] }],
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
    return result.filePath;
  });

  ipcMain.handle('credential:set', (_event, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.encryptString(value).toString('base64');
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
