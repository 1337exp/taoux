/**
 * Size above which a file is not opened: a project of hundreds of nodes weighs tens of KB.
 * Размер файла, больше которого не открываем: проект на сотни нод весит десятки КБ.
 */
export const MAX_FILE_BYTES = 5_000_000;

/**
 * Downloads text as a file through a temporary link.
 * Скачивание текста как файла через временную ссылку.
 */
export function downloadText(filename: string, text: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    // The browser must get time to start the download, so the link is not released at once.
    // Браузер должен успеть начать скачивание, поэтому освобождаем ссылку не сразу.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
