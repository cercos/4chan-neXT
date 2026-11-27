import CrossOrigin from "../platform/CrossOrigin";
import { parseAnswer } from "./CaptchaSolverLogic";
import {
  IMG_SIZE, MAX_TOKENS, inputSize, promptImageB64, rgbaToChw, softmax, stripTags, tokenize,
} from "./CaptchaBrowserSolverLogic";

export interface SolveResult {
  choices: (number | null)[];
  answer: string;
  confidence: number;
  taskConfidence: number[] | null;
}

const ORT_VERSION = '1.17.3';
const ORT_JS_URL = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.wasm.min.js`;
const ORT_WASM_URL = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort-wasm-simd.wasm`;
const MODEL_RELEASE_URL = 'https://raw.githubusercontent.com/cercos/4chan-neXT/beta/assets/captcha-model/';
const MODEL_MANIFEST_URL = `${MODEL_RELEASE_URL}model.json`;
const MODEL_FILE_URL = `${MODEL_RELEASE_URL}model.onnx`;
const MODEL_KEY = 'model';
const MODEL_INFO_KEY = 'model-info';
export const MODEL_FORMAT = 1;

export { modelLabel, modelUpdateAvailable, parseModelInfo, type ModelInfo } from './CaptchaBrowserSolverLogic';
import { parseModelInfo, type ModelInfo } from './CaptchaBrowserSolverLogic';

const DB_NAME = 'fourchanx-captcha-model';
const STORE = 'files';

let dbPromise: Promise<IDBDatabase> | null = null;
function openDB(): Promise<IDBDatabase> {
  return dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
}

async function cacheGet(key: string): Promise<Uint8Array | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result instanceof Uint8Array ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function cachePut(key: string, data: Uint8Array): Promise<void> {
  try {
    const db = await openDB();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(data, key);
  } catch {
  }
}

function download(url: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    CrossOrigin.binary(url, data => {
      if (data?.length) { resolve(data); } else { reject(new Error(`Download failed: ${url}`)); }
    });
  });
}

async function cacheDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
  } catch {
  }
}

const ENGINE_URLS = [ORT_JS_URL, ORT_WASM_URL];
export const ENGINE_SIZE_MB = 10.5;

export async function engineDownloaded(): Promise<boolean> {
  for (const url of ENGINE_URLS) {
    if (!await cacheGet(url)) { return false; }
  }
  return true;
}

export async function downloadEngine(): Promise<void> {
  for (const url of ENGINE_URLS) {
    if (!await cacheGet(url)) { await cachePut(url, await download(url)); }
  }
}

export async function removeEngine(): Promise<void> {
  sessionPromise = null;
  ortRef = null;
  for (const url of ENGINE_URLS) { await cacheDelete(url); }
}


export async function installedModel(): Promise<ModelInfo | null> {
  const raw = await cacheGet(MODEL_INFO_KEY);
  if (!raw || !await cacheGet(MODEL_KEY)) { return null; }
  try {
    return parseModelInfo(JSON.parse(new TextDecoder().decode(raw)));
  } catch {
    return null;
  }
}

export async function latestModel(): Promise<ModelInfo> {
  const req = await CrossOrigin.ajaxPromise(`${MODEL_MANIFEST_URL}?t=${Date.now()}`, { responseType: 'text', timeout: 15000 });
  if (req.status !== 200) { throw new Error(`could not check for models (HTTP ${req.status || 'network error'})`); }
  let info: ModelInfo | null = null;
  try { info = parseModelInfo(JSON.parse(String(req.response))); } catch {}
  if (!info) { throw new Error('model info is invalid'); }
  return info;
}

export function modelCompatible(info: ModelInfo): boolean {
  return info.format === MODEL_FORMAT;
}

export async function downloadModel(info: ModelInfo): Promise<void> {
  if (!modelCompatible(info)) { throw new Error('this model needs a newer 4chan-neXT'); }
  const data = await download(`${MODEL_FILE_URL}?v=${info.version}`);
  await cachePut(MODEL_KEY, data);
  await cachePut(MODEL_INFO_KEY, new TextEncoder().encode(JSON.stringify(info)));
  sessionPromise = null;
}

export async function removeModel(): Promise<void> {
  sessionPromise = null;
  await cacheDelete(MODEL_KEY);
  await cacheDelete(MODEL_INFO_KEY);
}

export async function solverReady(): Promise<boolean> {
  return await engineDownloaded() && !!await installedModel();
}

async function engineFile(url: string): Promise<Uint8Array> {
  const hit = await cacheGet(url);
  if (!hit) { throw new Error('engine not downloaded yet, download it in Settings > Captcha'); }
  return hit;
}

let sessionPromise: Promise<any> | null = null; // loose: onnxruntime-web is loaded at runtime, no type decl
let ortRef: any = null; // loose: onnxruntime-web namespace loaded at runtime

async function createSession(): Promise<any> { // loose: onnxruntime-web InferenceSession, loaded at runtime
  const [js, wasm, model] = await Promise.all([
    engineFile(ORT_JS_URL),
    engineFile(ORT_WASM_URL),
    cacheGet(MODEL_KEY),
  ]);
  if (!model) { throw new Error('model not downloaded yet, download it in Settings > Captcha'); }
  const ort = new Function(`${new TextDecoder().decode(js)}\n;return ort;`)();
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = {
    'ort-wasm-simd.wasm': URL.createObjectURL(new Blob([wasm], {type: 'application/wasm'})),
  };
  ortRef = ort;
  return ort.InferenceSession.create(model);
}

export function warmBrowserSolver(): Promise<any> { // loose: onnxruntime-web InferenceSession
  sessionPromise ||= createSession().catch(err => {
    sessionPromise = null;
    throw err;
  });
  return sessionPromise;
}

async function imageData(b64: string, size?: [number, number]): Promise<{data: Float32Array; w: number; h: number}> {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
  const [w, h] = size || inputSize(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', {willReadFrequently: true})!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return {data: rgbaToChw(ctx.getImageData(0, 0, w, h).data, w, h), w, h};
}

function promptText(str: unknown): string {
  const ta = document.createElement('textarea');
  ta.innerHTML = stripTags(typeof str === 'string' ? str : '');
  return ta.value.trim();
}

export async function browserSolveTasks(challenge: {tasks?: any[]}): Promise<SolveResult> { // loose: vendor TCaptcha task objects
  const tasks = challenge?.tasks;
  if (!tasks?.length) { throw new Error('No captcha tasks to solve'); }
  let session;
  try {
    session = await warmBrowserSolver();
  } catch (err: any) { // loose: any thrown value
    throw new Error(`Browser solver couldn't load (${err?.message || err})`);
  }
  const ort = ortRef;
  let answer = '';
  let confidence = 1;
  const taskConfidence: number[] = [];
  for (const task of tasks) {
    const items: string[] = (task?.items || []).filter((i: unknown) => typeof i === 'string');
    if (!items.length || items.length > 10) {
      answer += ' ';
      confidence = 0;
      taskConfidence.push(0);
      continue;
    }
    const first = await imageData(items[0]);
    const tiles = [first, ...await Promise.all(items.slice(1).map(b => imageData(b, [first.w, first.h])))];
    const plane = 3 * first.w * first.h;
    const itemsData = new Float32Array(items.length * plane);
    tiles.forEach((t, i) => itemsData.set(t.data, i * plane));
    const pb = promptImageB64(task);
    const prompt = pb ? (await imageData(pb, [IMG_SIZE, IMG_SIZE])).data : new Float32Array(3 * IMG_SIZE * IMG_SIZE);
    const feeds = {
      prompt_img: new ort.Tensor('float32', prompt, [1, 3, IMG_SIZE, IMG_SIZE]),
      has_prompt: new ort.Tensor('float32', new Float32Array([pb ? 1 : 0]), [1]),
      tokens: new ort.Tensor('int64', BigInt64Array.from(tokenize(promptText(task.str)).map(BigInt)), [1, MAX_TOKENS]),
      items: new ort.Tensor('float32', itemsData, [1, items.length, 3, first.h, first.w]),
      item_mask: new ort.Tensor('float32', new Float32Array(items.length).fill(1), [1, items.length]),
    };
    const out = await session.run(feeds);
    const probs = softmax(out.logits.data);
    const best = probs.indexOf(Math.max(...probs));
    answer += String(best);
    confidence = Math.min(confidence, probs[best]);
    taskConfidence.push(probs[best]);
  }
  return {answer, choices: parseAnswer(answer, tasks), confidence, taskConfidence};
}
