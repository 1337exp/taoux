import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText, MAX_FILE_BYTES, readTextFile } from '../src/file';

afterEach(() => vi.restoreAllMocks());

describe('downloadText', () => {
    function capture() {
        const blobs: Blob[] = [];
        vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => (blobs.push(blob as Blob), 'blob:x'));
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        return { blobs, click };
    }

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
