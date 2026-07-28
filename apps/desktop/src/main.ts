import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import type { OurStageProject } from '@our-stage/project-schema';
import type {
  AiGenerateRequest,
  ExportProgress,
  ExportRequest,
  ExportResult,
  ExportSession,
} from '@our-stage/platform-api';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ourstage-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const __dirname = path.dirname(__filename);
let mainWindow: BrowserWindow | null = null;
const allowedAssetRoots = new Set<string>();
let dataRoot = '';
let autosavePath = '';
let recentPath = '';
let credentialsPath = '';

type FfmpegProcess = ChildProcessByStdio<Writable, null, Readable>;

interface ExportJob {
  jobId: string;
  process: FfmpegProcess;
  outputPath: string;
  frameCount: number;
  writtenFrames: number;
  startedAt: number;
  stderr: string;
  closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

const exportJobs = new Map<string, ExportJob>();

function isInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assetUrl(filePath: string) {
  const resolved = path.resolve(filePath);
  const root = path.dirname(resolved);
  allowedAssetRoots.add(root);
  const token = Buffer.from(root, 'utf8').toString('base64url');
  return `ourstage-asset://local/${token}/${encodeURIComponent(path.basename(resolved))}`;
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

async function ensureDataDirectories() {
  dataRoot = path.join(app.getPath('userData'), 'OurStageData');
  autosavePath = path.join(dataRoot, 'projects', 'autosave.ourstage');
  recentPath = path.join(dataRoot, 'recent-projects.json');
  credentialsPath = path.join(dataRoot, 'credentials.json');
  await Promise.all(
    ['library/models', 'library/motions', 'library/audio', 'projects', 'exports', 'cache', 'logs']
      .map((entry) => mkdir(path.join(dataRoot, entry), { recursive: true })),
  );
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function addRecent(project: OurStageProject, filePath: string) {
  const recent = await readJson<Array<{ name: string; path: string; updatedAt: string }>>(
    recentPath,
    [],
  );
  const next = [
    { name: project.metadata.name, path: filePath, updatedAt: new Date().toISOString() },
    ...recent.filter((item) => item.path !== filePath),
  ].slice(0, 12);
  await writeFile(recentPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function createWindow() {
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

function registerAssetProtocol() {
  protocol.handle('ourstage-asset', (request) => {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.split('/').filter(Boolean);
      const token = segments.shift();
      if (!token || segments.length === 0) {
        return new Response('Invalid asset URL.', { status: 400 });
      }
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

function firstAudioInput(project: OurStageProject) {
  for (const track of project.tracks) {
    if (track.type !== 'audio' || !track.enabled) continue;
    const clip = track.clips.find((item) => item.enabled);
    if (!clip) continue;
    const asset = project.assets.find((item) => item.assetId === clip.audioAssetId);
    if (asset?.sourcePath) {
      return {
        sourcePath: asset.sourcePath,
        startSeconds: clip.startSeconds,
        sourceOffsetSeconds: clip.sourceOffsetSeconds,
        volume: clip.volume,
      };
    }
  }
  return null;
}

async function startExport(request: ExportRequest): Promise<ExportSession | null> {
  const project = request.project;
  const defaultName = `${project.metadata.name.replace(/[^a-z0-9-_]+/gi, '-') || 'our-stage'}.mp4`;
  const save = request.outputPath
    ? { canceled: false, filePath: request.outputPath }
    : await dialog.showSaveDialog({
        defaultPath: path.join(dataRoot, 'exports', defaultName),
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
      });
  if (save.canceled || !save.filePath) return null;

  const outputPath = path.resolve(save.filePath);
  const frameCount = Math.ceil(project.output.durationSeconds * project.output.fps);
  const audio = firstAudioInput(project);
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(project.output.fps),
    '-vcodec', 'png', '-i', 'pipe:0',
  ];
  if (audio) {
    args.push(
      '-itsoffset', String(audio.startSeconds),
      '-ss', String(audio.sourceOffsetSeconds),
      '-i', audio.sourcePath,
    );
  }
  args.push('-map', '0:v:0');
  if (audio) {
    args.push(
      '-map', '1:a:0?',
      '-filter:a', `volume=${audio.volume}`,
      '-c:a', 'aac',
      '-b:a', '192k',
    );
  }
  args.push(
    '-t', String(project.output.durationSeconds),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  );

  const ffmpegProcess = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, {
    stdio: ['pipe', 'ignore', 'pipe'],
    windowsHide: true,
  });
  ffmpegProcess.stdin.on('error', () => undefined);
  await new Promise<void>((resolve, reject) => {
    ffmpegProcess.once('spawn', resolve);
    ffmpegProcess.once('error', reject);
  });

  const jobId = randomUUID();
  const job: ExportJob = {
    jobId,
    process: ffmpegProcess,
    outputPath,
    frameCount,
    writtenFrames: 0,
    startedAt: Date.now(),
    stderr: '',
    closed: new Promise((resolve) => {
      ffmpegProcess.once('close', (code, signal) => resolve({ code, signal }));
    }),
  };
  ffmpegProcess.stderr.setEncoding('utf8');
  ffmpegProcess.stderr.on('data', (chunk: string) => {
    job.stderr = `${job.stderr}${chunk}`.slice(-16000);
  });
  exportJobs.set(jobId, job);
  return { jobId, outputPath, frameCount, fps: project.output.fps };
}

async function writeExportFrame(
  jobId: string,
  frameIndex: number,
  bytes: Uint8Array,
): Promise<ExportProgress> {
  const job = exportJobs.get(jobId);
  if (!job) throw new Error('Unknown or completed export job.');
  if (frameIndex !== job.writtenFrames) {
    throw new Error(`Expected frame ${job.writtenFrames}, received ${frameIndex}.`);
  }
  if (bytes.byteLength === 0 || bytes.byteLength > 64 * 1024 * 1024) {
    throw new Error('Rendered frame has an invalid size.');
  }
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      job.process.stdin.off('error', onError);
      job.process.stdin.off('drain', onDrain);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    job.process.stdin.once('error', onError);
    const accepted = job.process.stdin.write(Buffer.from(bytes));
    if (accepted) {
      cleanup();
      resolve();
    } else {
      job.process.stdin.once('drain', onDrain);
    }
  });
  job.writtenFrames += 1;
  return {
    jobId,
    frameIndex: job.writtenFrames,
    frameCount: job.frameCount,
    ratio: Math.min(1, job.writtenFrames / job.frameCount),
  };
}

async function finishExport(jobId: string): Promise<ExportResult> {
  const job = exportJobs.get(jobId);
  if (!job) throw new Error('Unknown or completed export job.');
  if (job.writtenFrames !== job.frameCount) {
    throw new Error(`Export is incomplete: ${job.writtenFrames}/${job.frameCount} frames.`);
  }
  job.process.stdin.end();
  const result = await job.closed;
  exportJobs.delete(jobId);
  if (result.code !== 0) {
    await unlink(job.outputPath).catch(() => undefined);
    throw new Error(job.stderr || `FFmpeg exited with code ${String(result.code)}.`);
  }
  return {
    outputPath: job.outputPath,
    durationMs: Date.now() - job.startedAt,
    frameCount: job.frameCount,
  };
}

async function cancelExport(jobId: string) {
  const job = exportJobs.get(jobId);
  if (!job) return;
  exportJobs.delete(jobId);
  job.process.stdin.destroy();
  job.process.kill('SIGTERM');
  setTimeout(() => {
    if (!job.process.killed) job.process.kill('SIGKILL');
  }, 1500).unref();
  await unlink(job.outputPath).catch(() => undefined);
}

async function readCredential(provider: string): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const credentials = await readJson<Record<string, string>>(credentialsPath, {});
  const encrypted = credentials[provider];
  return encrypted
    ? safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    : null;
}

function sanitiseProjectForAi(project: OurStageProject) {
  return {
    ...project,
    assets: project.assets.map((asset) => ({
      assetId: asset.assetId,
      type: asset.type,
      title: asset.title,
      contentHash: asset.contentHash,
      sizeBytes: asset.sizeBytes,
      ...(asset.source ? { source: asset.source } : {}),
    })),
  };
}

async function generateDeepSeekPatch(request: AiGenerateRequest): Promise<unknown> {
  const apiKey = await readCredential('deepseek');
  if (!apiKey) throw new Error('Save a DeepSeek API key before using this provider.');
  const shape = {
    patchId: 'string',
    baseProjectRevision: request.project.revision,
    summary: 'string',
    operations: [
      'add_clip', 'remove_clip', 'move_clip', 'resize_clip',
      'replace_motion', 'set_clip_speed', 'update_bone_override',
      'replace_bone_override_clips',
    ],
    assumptions: ['string'],
    warnings: ['string'],
  };
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content: 'You are the Our Stage AI Director. Return JSON only. Use only supplied IDs. Never invent motions, actors, tracks, bones, morphs, cameras, or assets. Produce minimal deterministic project operations. The JSON shape is: '
            + JSON.stringify(shape),
        },
        {
          role: 'user',
          content: JSON.stringify({
            mode: request.mode,
            instruction: request.request,
            project: sanitiseProjectForAi(request.project),
            context: request.context ?? null,
          }),
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`DeepSeek request failed: HTTP ${response.status} ${await response.text()}`);
  }
  const body = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned no structured patch.');
  return JSON.parse(content) as unknown;
}

function registerIpc() {
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
      return readJson<OurStageProject | null>(autosavePath, null);
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
  ipcMain.handle('credential:has', async (_event, provider: string) =>
    Boolean((await readJson<Record<string, string>>(credentialsPath, {}))[provider]),
  );
  ipcMain.handle('export:start', (_event, request: ExportRequest) => startExport(request));
  ipcMain.handle(
    'export:write-frame',
    (_event, jobId: string, frameIndex: number, bytes: Uint8Array) =>
      writeExportFrame(jobId, frameIndex, bytes),
  );
  ipcMain.handle('export:finish', (_event, jobId: string) => finishExport(jobId));
  ipcMain.handle('export:cancel', (_event, jobId: string) => cancelExport(jobId));
  ipcMain.handle('ai:generate', (_event, request: AiGenerateRequest) =>
    generateDeepSeekPatch(request),
  );
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

app.on('before-quit', () => {
  for (const jobId of exportJobs.keys()) void cancelExport(jobId);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
