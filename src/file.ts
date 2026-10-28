/**
 * Size above which a file is not opened: a project of hundreds of nodes weighs tens of KB.
 * Размер файла, больше которого не открываем: проект на сотни нод весит десятки КБ.
 */
export const MAX_FILE_BYTES = 5_000_000;

/**
 * Downloads text as a file through a temporary link. `mime` is the type of the file (JSON by default).
 * Скачивание текста как файла через временную ссылку. `mime` — тип файла (по умолчанию JSON).
 */
export function downloadText(filename: string, text: string, mime = 'application/json'): void {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    // The browser must get time to start the download, so the link is not released at once.
    // Браузер должен успеть начать скачивание, поэтому освобождаем ссылку не сразу.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ReadTextResult = { ok: true; text: string } | { ok: false; error: 'tooLarge' | 'unreadable' };

/**
 * Reads a picked file as text. A file above `limit` bytes is refused before it is read; a failed read is a result,
 * not an exception.
 * Читает выбранный файл как текст. Файл больше `limit` байт отклоняется до чтения; сбой чтения — результат, а не исключение.
 */
export async function readTextFile(file: Blob, limit = MAX_FILE_BYTES): Promise<ReadTextResult> {
    if (file.size > limit) return { ok: false, error: 'tooLarge' };
    try {
        return { ok: true, text: await file.text() };
    } catch {
        return { ok: false, error: 'unreadable' };
    }
}
