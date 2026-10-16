import { ref } from 'vue';

/**
 * Есть ли у устройства грубый указатель (палец): тогда показываем сенсорные кнопки в тулбаре.
 * Берём `any-pointer`, чтобы ноутбук с сенсорным экраном тоже получил их, а размеры целей касания
 * в CSS зависят от основного указателя (`pointer: coarse`).
 */
export const coarse = ref(false);

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const query = window.matchMedia('(any-pointer: coarse)');
    coarse.value = query.matches;
    query.addEventListener?.('change', (e) => (coarse.value = e.matches));
}
