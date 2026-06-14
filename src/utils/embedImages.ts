// Download externally-hosted images referenced in editor HTML and inline them
// as base64 data URLs, so exported quizzes stay self-contained: a remote host
// that disappears, goes offline, or blocks hotlinking at game time would
// otherwise leave the question with a broken image. External URLs that can't be
// fetched (CORS, 404, offline) are left untouched rather than dropped.

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

const isExternalUrl = (src: string): boolean => /^https?:\/\//i.test(src);

const fetchAsDataUrl = async (url: string): Promise<string | null> => {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) return null;
        return await blobToDataUrl(blob);
    } catch {
        // CORS rejection, network failure, etc. — keep the original URL
        return null;
    }
};

// Replace every <img> whose src is an http(s) URL with a base64 data URL.
// Same remote URL is fetched only once; the original HTML is returned unchanged
// when there's nothing external to inline or nothing could be fetched.
export const embedExternalImages = async (html: string): Promise<string> => {
    if (!html || !/<img\b/i.test(html)) return html;

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const external = Array.from(doc.querySelectorAll('img'))
        .filter(img => isExternalUrl(img.getAttribute('src') || ''));
    if (external.length === 0) return html;

    const unique = Array.from(new Set(external.map(img => img.getAttribute('src')!)));
    const resolved = new Map<string, string>();
    await Promise.all(unique.map(async (url) => {
        const dataUrl = await fetchAsDataUrl(url);
        if (dataUrl) resolved.set(url, dataUrl);
    }));
    if (resolved.size === 0) return html;

    external.forEach((img) => {
        const dataUrl = resolved.get(img.getAttribute('src')!);
        if (dataUrl) img.setAttribute('src', dataUrl);
    });
    return doc.body.innerHTML;
};
