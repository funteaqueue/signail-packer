// Trim audio/video embedded as base64 data URLs, using ffmpeg.wasm.
// The core + worker are fetched from a CDN on first use (lazy, cached for the
// session) so nothing heavy ships in the main bundle. The single-thread core
// needs no SharedArrayBuffer / COOP-COEP headers.
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.10';
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let ffmpegPromise: Promise<FFmpeg> | null = null;

const loadFFmpeg = (): Promise<FFmpeg> => {
    if (!ffmpegPromise) {
        ffmpegPromise = (async () => {
            const ffmpeg = new FFmpeg();
            // The wrapper worker is bundled by webpack (new URL('./worker.js', ...));
            // only the core + wasm come from the CDN as blob URLs.
            await ffmpeg.load({
                coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            return ffmpeg;
        })().catch(err => { ffmpegPromise = null; console.error('[ffmpeg load]', err); throw err; });
    }
    return ffmpegPromise;
};

const mimeOf = (dataUrl: string): string =>
    dataUrl.startsWith('data:') ? dataUrl.slice(5, dataUrl.indexOf(',')).split(';')[0] : '';

const inputExt = (mime: string): string => {
    const map: Record<string, string> = {
        'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
        'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/aac': 'aac', 'audio/mp4': 'm4a',
        'audio/flac': 'flac', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv',
        'video/quicktime': 'mov', 'video/x-matroska': 'mkv',
    };
    return map[mime] || (mime.startsWith('video/') ? 'mp4' : 'bin');
};

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

export const isTrimmableMedia = (dataUrl: string): boolean => {
    const mime = mimeOf(dataUrl);
    return mime.startsWith('audio/') || mime.startsWith('video/');
};

export const isVideoMedia = (dataUrl: string): boolean => mimeOf(dataUrl).startsWith('video/');

// Cut [startSec, endSec) out of the media and return a fresh data URL.
// Video re-encodes to H.264/AAC mp4; audio to mp3. onProgress gets 0..1.
export const trimMedia = async (
    dataUrl: string,
    startSec: number,
    endSec: number,
    onProgress?: (ratio: number) => void
): Promise<string> => {
    const mime = mimeOf(dataUrl);
    const isVideo = mime.startsWith('video/');
    const inName = `input.${inputExt(mime)}`;
    const outName = isVideo ? 'output.mp4' : 'output.mp3';
    const outMime = isVideo ? 'video/mp4' : 'audio/mpeg';
    const dur = Math.max(0.05, endSec - startSec);

    const ffmpeg = await loadFFmpeg();
    // ffmpeg.wasm's `progress` ratio is processedTime / fullInputDuration, so a
    // short cut out of a long clip stalls at a low value then snaps to 1 at the
    // end. Derive progress ourselves from `time` (microseconds of output
    // produced) against the trim duration instead.
    const onProg = ({ time }: { progress: number; time: number }) =>
        onProgress?.(Math.min(1, Math.max(0, time / 1e6 / dur)));
    if (onProgress) ffmpeg.on('progress', onProg);
    try {
        await ffmpeg.writeFile(inName, await fetchFile(dataUrl));
        const args = isVideo
            ? ['-ss', String(startSec), '-i', inName, '-t', String(dur),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
                '-c:a', 'aac', '-movflags', '+faststart', outName]
            : ['-ss', String(startSec), '-i', inName, '-t', String(dur),
                '-c:a', 'libmp3lame', '-q:a', '4', outName];
        await ffmpeg.exec(args);
        const data = await ffmpeg.readFile(outName);
        await ffmpeg.deleteFile(inName).catch(() => {});
        await ffmpeg.deleteFile(outName).catch(() => {});
        const bytes = data as Uint8Array;
        return await blobToDataUrl(new Blob([bytes], { type: outMime }));
    } finally {
        if (onProgress) ffmpeg.off('progress', onProg);
    }
};
