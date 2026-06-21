import { useEffect, useRef, useState } from 'react';
import ReactQuill from 'react-quill';

// When you "Copy image" on a website the OS puts BOTH a <img> link and the
// decoded image bytes on the clipboard; Quill would paste the link (a remote
// URL that can break later, and whose bytes JS can't read back out of the
// rendered <img> because of cross-origin security). This hook intercepts the
// paste on a ReactQuill editor and prefers the bytes — no network, no CORS —
// embedding them as base64. Pastes that carry only a link (no bytes) fall
// through to Quill and are flagged via the returned warning so the caller can
// tell the author the content isn't self-contained yet.
export function usePasteImageBytes(
  quillRef: React.RefObject<ReactQuill>,
  buildLinkWarning: (count: number) => string,
) {
  // Images already inspected, so repeated pastes don't re-flag the same link.
  const processedImages = useRef<WeakSet<Element>>(new WeakSet());
  const [pasteWarning, setPasteWarning] = useState<string | null>(null);

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const root = quill.root;

    // Embed the raw image bytes carried on the clipboard, in order, at the cursor.
    const insertClipboardImages = (files: File[]) => {
      const start = (quill.getSelection(true) || { index: quill.getLength() }).index;
      files.forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = () => {
          const index = start + i;
          quill.insertEmbed(index, 'image', reader.result as string, 'user');
          quill.setSelection(index + 1, 0);
        };
        reader.readAsDataURL(file);
      });
    };

    const handlePaste = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;
      const imageFiles = Array.from(data.items)
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter((f): f is File => f !== null);

      // Prefer raw image bytes whenever they're present and the paste isn't
      // really a block of text (where an image would only be incidental). The
      // accompanying HTML may wrap the <img> in <a>/<figure>/styling, so we key
      // off the plain text rather than trying to parse the markup.
      const text = (data.getData('text/plain') || '').trim();
      const textIsJustUrls = text === ''
        || text.split(/\s+/).every((token) => /^https?:\/\//i.test(token));

      if (imageFiles.length > 0 && textIsJustUrls) {
        // We have the pixels locally — use them and stop Quill pasting the link.
        e.preventDefault();
        e.stopPropagation();
        insertClipboardImages(imageFiles);
        return;
      }

      // No bytes to embed: let Quill paste, then check whether it landed a remote
      // <img> link and let the author know it's not embedded.
      root.querySelectorAll('img').forEach((img) => processedImages.current.add(img));
      const onChange = () => {
        quill.off('text-change', onChange);
        const linked = Array.from(quill.root.querySelectorAll('img')).filter(
          (img) => !processedImages.current.has(img)
            && /^https?:\/\//i.test(img.getAttribute('src') || ''),
        );
        linked.forEach((img) => processedImages.current.add(img));
        if (linked.length > 0) {
          setPasteWarning(buildLinkWarning(linked.length));
        }
      };
      quill.on('text-change', onChange);
    };

    root.addEventListener('paste', handlePaste, true);
    return () => root.removeEventListener('paste', handlePaste, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pasteWarning, clearPasteWarning: () => setPasteWarning(null) };
}
