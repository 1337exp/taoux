<script lang="ts" setup>
import { TaoButton, TaoIcon } from '@1337exp/taoui';
import { ref } from 'vue';
import { moveItem, sortableTextsEn, sortableTextsRu, useSortable } from '../src/sortable';
import { lang, tr } from './lang';
import SandboxShell from './SandboxShell.vue';

// A list reordered by its grip, with the pointer or the keyboard. The list is the page's: useSortable only says from → to.
// Список, который переставляют за ручку, указателем или с клавиатуры. Список принадлежит странице.
const tasks = ref([
    { id: 'a', title: ['Write the plan', 'Написать план'] },
    { id: 'b', title: ['Call the designer', 'Позвонить дизайнеру'] },
    { id: 'c', title: ['Review the release notes', 'Проверить заметки к релизу'] },
    { id: 'd', title: ['Book the room', 'Забронировать переговорную'] },
    { id: 'e', title: ['Answer the mail', 'Ответить на почту'] },
    { id: 'f', title: ['Water the plants', 'Полить цветы'] },
]);

const listRef = ref<HTMLElement | null>(null);
const { dragging, lifted } = useSortable(listRef, {
    onMove: (from, to) => (tasks.value = moveItem(tasks.value, from, to)),
    texts: () => (lang.value === 'ru' ? sortableTextsRu : sortableTextsEn),
    itemLabel: (el) => el.querySelector('.task__title')?.textContent ?? '',
});
</script>

<template>
    <SandboxShell
        :title="tr('sortable · reorder by a grip', 'sortable · перестановка за ручку')"
        :note="
            tr(
                'Drag a grip: the item lifts, the others make room, the list scrolls at its edge, Esc puts it back. Or Tab to a grip: Space lifts, ↑ ↓ move, Space drops, Esc returns it.',
                'Тяните за ручку: элемент поднимается, остальные расступаются, у края список прокручивается, Esc возвращает. Или Tab до ручки: Пробел поднимает, ↑ ↓ двигают, Пробел ставит, Esc возвращает.',
            )
        "
    >
        <ul ref="listRef" class="tasks">
            <li v-for="task in tasks" :key="task.id" class="task" data-sortable-item>
                <TaoButton
                    data-sortable-handle
                    class="task__grip"
                    variant="ghost"
                    tone="neutral"
                    size="small"
                    icon="tao-grip"
                    :aria-label="tr(`Move: ${task.title[0]}`, `Переставить: ${task.title[1]}`)"
                />
                <span class="task__title">{{ tr(task.title[0]!, task.title[1]!) }}</span>
                <TaoIcon v-if="lifted !== null && tasks[lifted]?.id === task.id" name="tao-arrow-up" class="task__hint" />
            </li>
        </ul>
        <p class="muted">{{ tr('Order:', 'Порядок:') }} {{ tasks.map((t) => t.id).join(' ') }} · dragging {{ dragging }} · lifted {{ lifted }}</p>
    </SandboxShell>
</template>

<style scoped>
.tasks {
    display: grid;
    gap: 8px;
    max-width: 420px;
    max-height: 260px;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    list-style: none;
}

.task {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px 6px 6px;
    border: 1px solid var(--tao-color-border);
    border-radius: var(--tao-radius-panel);
    background: var(--tao-color-surface-raised);
    color: var(--tao-color-text);
}

.task__grip {
    cursor: grab;
    touch-action: none;
}

/* the lifted item: what useSortable marks, styled by the app / поднятый элемент: метку ставит useSortable, вид — приложение */
.task[data-sortable-dragging],
.task[data-sortable-lifted] {
    border-color: var(--tao-color-accent);
    box-shadow: var(--tao-shadow-lg);
}

.task[data-sortable-dragging] .task__grip {
    cursor: grabbing;
}

.task__hint {
    margin-inline-start: auto;
    color: var(--tao-color-accent);
}

.muted {
    color: var(--tao-color-text-muted);
    font-size: 12px;
}
</style>
