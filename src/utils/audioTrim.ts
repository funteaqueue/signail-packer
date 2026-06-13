// Audio decoding helpers for the karaoke waveform (Web Audio API).
// The actual trimming/re-encoding is done by ffmpeg.wasm (see mediaTrim.ts),
// which produces compact mp3 output.

const dataUrlToBytes = (dataUrl: string): { bytes: Uint8Array; mime: string } | null => {
    if (!dataUrl.startsWith('data:')) return null;
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const mime = dataUrl.slice(5, comma).split(';')[0] || 'application/octet-stream';
    try {
        const binary = atob(dataUrl.slice(comma + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return { bytes, mime };
    } catch {
        return null;
    }
};

const makeContext = (): AudioContext => {
    const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    return new AC();
};

export const decodeAudioFromDataUrl = async (dataUrl: string): Promise<AudioBuffer | null> => {
    const decoded = dataUrlToBytes(dataUrl);
    if (!decoded) return null;
    const ctx = makeContext();
    try {
        const buffer = new ArrayBuffer(decoded.bytes.length);
        new Uint8Array(buffer).set(decoded.bytes);
        return await ctx.decodeAudioData(buffer);
    } catch {
        return null;
    } finally {
        ctx.close();
    }
};

// Max absolute amplitude per bucket (channel 0) — enough for a visual waveform.
export const computePeaks = (buffer: AudioBuffer, buckets: number): number[] => {
    const ch = buffer.getChannelData(0);
    const per = Math.max(1, Math.floor(ch.length / buckets));
    const peaks: number[] = [];
    for (let b = 0; b < buckets; b++) {
        let peak = 0;
        const from = b * per;
        const to = Math.min(ch.length, from + per);
        for (let i = from; i < to; i += 16) {
            const v = Math.abs(ch[i]);
            if (v > peak) peak = v;
        }
        peaks.push(peak);
    }
    return peaks;
};
