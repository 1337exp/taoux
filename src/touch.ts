import { ref } from 'vue';

/**
 * Whether the device has a coarse pointer (a finger): then touch buttons are shown in the toolbar.
 * `any-pointer` is used so that a laptop with a touch screen gets them too, while the size of touch targets
 * in CSS depends on the primary pointer (`pointer: coarse`).
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
