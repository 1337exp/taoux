import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, downloadText, MAX_FILE_BYTES, readTextFile } from '../src/file';

afterEach(() => vi.restoreAllMocks());

function capture() {
    const blobs: Blob[] = [];
    const names: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => (blobs.push(blob as Blob), 'blob:x'));
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download);
        // the link must be in the document while it is clicked
        expect(document.body.contains(this)).toBe(true);
    });
    return { blobs, names, click };
}

describe('downloadBlob', () => {
    it('saves the bytes under the given name and type', async () => {
        const { blobs, names, click } = capture();
        downloadBlob('sheet.zip', new Uint8Array([80, 75, 3, 4]), 'application/zip');
        expect(names).toEqual(['sheet.zip']);
        expect(click).toHaveBeenCalledOnce();
        expect(blobs[0]!.type).toBe('application/zip');
        expect(new Uint8Array(await blobs[0]!.arrayBuffer())).toEqual(new Uint8Array([80, 75, 3, 4]));
    });

    it('keeps the type of a Blob when none is given, else it is a binary file', () => {
        const { blobs } = capture();
        downloadBlob('a.png', new Blob(['x'], { type: 'image/png' }));
        downloadBlob('b.bin', new Uint8Array(1));
        expect(blobs.map((b) => b.type)).toEqual(['image/png', 'application/octet-stream']);
    });

    it('lets go of its link: nothing is left in the document', () => {
        capture();
        downloadBlob('a.bin', new Uint8Array(1));
        expect(document.querySelector('a[download]')).toBeNull();
    });
});

describe('downloadText', () => {
    it('is JSON by default', () => {
        const { blobs, click } = capture();
        downloadText('a.json', '{}');
        expect(blobs[0]!.type).toBe('application/json');
        expect(click).toHaveBeenCalledOnce();
    });

    it('takes the type of the file', () => {
        const { blobs } = capture();
        downloadText('notes.md', '# hi', 'text/markdown');
        expect(blobs[0]!.type).toBe('text/markdown');
    });
});

describe('readTextFile', () => {
    it('reads the text of a file', async () => {
        expect(await readTextFile(new Blob(['привет']))).toEqual({ ok: true, text: 'привет' });
    });

    it('refuses a file above the limit before reading it', async () => {
        const big = new Blob(['x'.repeat(11)]);
        const text = vi.spyOn(big, 'text');
        expect(await readTextFile(big, 10)).toEqual({ ok: false, error: 'tooLarge' });
        expect(text).not.toHaveBeenCalled();
    });

    it('the default limit is MAX_FILE_BYTES', async () => {
        expect(await readTextFile({ size: MAX_FILE_BYTES + 1 } as Blob)).toEqual({ ok: false, error: 'tooLarge' });
    });

    it('a failed read is a result, not an exception', async () => {
        const broken = { size: 1, text: () => Promise.reject(new Error('nope')) } as unknown as Blob;
        expect(await readTextFile(broken)).toEqual({ ok: false, error: 'unreadable' });
    });
});
