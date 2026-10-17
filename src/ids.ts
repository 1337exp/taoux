let counter = 0;

/**
 * A unique id with a prefix; `taken` lets you skip ids already in use (for example, loaded from a file).
 * Уникальный id с префиксом; `taken` позволяет пропустить уже занятые (например, загруженные из файла).
 */
export function uid(prefix: string, taken: (id: string) => boolean = () => false): string {
    let id: string;
    do id = `${prefix}${++counter}`;
    while (taken(id));
    return id;
}
