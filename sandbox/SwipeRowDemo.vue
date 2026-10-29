<script lang="ts" setup>
import { TaoAvatar } from '@1337exp/taoui';
import { computed, ref } from 'vue';
import { TaoxSwipeRow } from '../src/swiperow';
import { tr } from './lang';
import SandboxShell from './SandboxShell.vue';

// A mail list: a pull to the right marks read / unread, to the left opens More, Unsubscribe, Delete, and a long pull
// to the left deletes. The list is the page's: the row only says which action was chosen.
// Список писем: вправо — прочитано / не прочитано, влево — Ещё, Отписаться, Удалить, длинный свайп влево удаляет.
const mails = ref([
    { id: 1, from: 'Finam', subject: ['Investors take profit', 'Инвесторы фиксируют прибыль'], text: ['Your AI picks for today', 'Ваши рекомендации на сегодня'], read: false, time: '12:14', full: true },
    { id: 2, from: 'RZD Bonus', subject: ['Points added', 'Начисление баллов'], text: ['500 points went to your account', 'На ваш счёт начислено 500 баллов'], read: true, time: '10:25', full: false },
    { id: 3, from: 'GitHub', subject: ['A new release', 'Новый релиз'], text: ['taoux 0.5.0 is out', 'Вышла taoux 0.5.0'], read: false, time: '09:02', full: true },
    { id: 4, from: 'Mom', subject: ['Dinner on Sunday?', 'Ужин в воскресенье?'], text: ['Bring the cake', 'Захвати торт'], read: true, time: 'Yesterday', full: false },
]);
const log = ref<string[]>([]);

const startFor = (read: boolean) =>
    read
        ? { id: 'toggle', label: tr('Unread', 'Не прочитано'), icon: 'tao-bell', tone: 'info' as const }
        : { id: 'toggle', label: tr('Read', 'Прочитано'), icon: 'tao-check', tone: 'info' as const };


// the actions are the app's, per row: a newsletter can be unsubscribed from, a letter from a person cannot
// действия задаёт приложение, для каждой строки свои: от рассылки можно отписаться, от письма человека — нет
const more = computed(() => ({ id: 'more', label: tr('More', 'Ещё'), icon: 'tao-more-horizontal' }));
const mute = computed(() => ({ id: 'mute', label: tr('Unsubscribe', 'Отписаться'), icon: 'tao-x-circle' }));
const del = computed(() => ({ id: 'delete', label: tr('Delete', 'Удалить'), icon: 'tao-trash', tone: 'danger' as const }));
const endFor = (full: boolean) => (full ? [more.value, mute.value, del.value] : [more.value, del.value]);

function onAction(mail: (typeof mails.value)[number], id: string) {
    log.value = [`${mail.from}: ${id}`, ...log.value].slice(0, 5);
    if (id === 'toggle') mail.read = !mail.read;
    if (id === 'delete') mails.value = mails.value.filter((m) => m !== mail);
}

// a second list with no start action: those rows go only to the left (a task list: nothing to mark read)
// второй список без действия слева: такие строки едут только влево (задачи: отмечать прочитанным нечего)
const tasks = ref([
    { id: 1, title: ['Pay the rent', 'Оплатить аренду'], due: ['Today', 'Сегодня'] },
    { id: 2, title: ['Renew the domain', 'Продлить домен'], due: ['Friday', 'Пятница'] },
    { id: 3, title: ['Call the bank', 'Позвонить в банк'], due: ['Next week', 'На следующей неделе'] },
]);
const taskEnd = computed(() => [
    { id: 'later', label: tr('Later', 'Позже'), icon: 'tao-calendar' },
    { id: 'delete', label: tr('Delete', 'Удалить'), icon: 'tao-trash', tone: 'danger' as const },
]);

function onTask(task: (typeof tasks.value)[number], id: string) {
    log.value = [`${tr(task.title[0]!, task.title[1]!)}: ${id}`, ...log.value].slice(0, 5);
    if (id === 'delete') tasks.value = tasks.value.filter((t) => t !== task);
}

function reset() {
    location.reload();
}
</script>

<template>
    <SandboxShell
        :title="tr('swiperow · a mail list', 'swiperow · список писем')"
        :note="
            tr(
                'Drag a row (a finger, or the mouse here): to the right marks it read / unread, to the left opens three actions, a long pull to the left deletes. Tab reaches the actions too.',
                'Тяните строку (пальцем, а здесь и мышью): вправо — прочитано / не прочитано, влево — три действия, длинный свайп влево удаляет. До действий можно дойти и Tab.',
            )
        "
    >
        <div class="mails">
            <TaoxSwipeRow v-for="mail in mails" :key="mail.id" mouse :start="startFor(mail.read)" :end="endFor(mail.full)" @action="onAction(mail, $event)">
                <div class="mail" :class="{ 'mail--unread': !mail.read }">
                    <TaoAvatar :name="mail.from" size="large" />
                    <div class="mail__body">
                        <div class="mail__top">
                            <span class="mail__from"><span v-if="!mail.read" class="mail__dot" />{{ mail.from }}</span>
                            <span class="mail__time">{{ mail.time }}</span>
                        </div>
                        <div class="mail__subject">{{ tr(mail.subject[0]!, mail.subject[1]!) }}</div>
                        <div class="mail__text">{{ tr(mail.text[0]!, mail.text[1]!) }}</div>
                    </div>
                </div>
            </TaoxSwipeRow>
        </div>
        <h3 class="subtitle">{{ tr('Only to the left: no start action', 'Только влево: без действия слева') }}</h3>
        <p class="muted">{{ tr('A row without `start` does not move to the right at all.', 'Строка без `start` вправо не сдвигается вовсе.') }}</p>
        <div class="mails">
            <TaoxSwipeRow v-for="task in tasks" :key="task.id" mouse :end="taskEnd" @action="onTask(task, $event)">
                <div class="mail">
                    <div class="mail__body">
                        <div class="mail__top">
                            <span class="mail__from">{{ tr(task.title[0]!, task.title[1]!) }}</span>
                            <span class="mail__time">{{ tr(task.due[0]!, task.due[1]!) }}</span>
                        </div>
                    </div>
                </div>
            </TaoxSwipeRow>
        </div>

        <p class="muted">{{ tr('Actions:', 'Действия:') }} {{ log.join(' · ') || '—' }} · <a href="#" @click.prevent="reset">{{ tr('reset', 'сначала') }}</a></p>
    </SandboxShell>
</template>

<style scoped>
.mails {
    display: grid;
    gap: 8px;
    max-width: 520px;
}

.mail {
    display: flex;
    gap: 12px;
    padding: 12px 14px;
    user-select: none;
}

.mail__body {
    flex: 1;
    min-width: 0;
}

.mail__top {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.mail__from,
.mail__subject {
    color: var(--tao-color-text-strong);
}

.mail--unread .mail__from,
.mail--unread .mail__subject {
    font-weight: 600;
}

.mail__dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-inline-end: 6px;
    border-radius: 50%;
    background: var(--tao-color-accent);
    vertical-align: middle;
}

.mail__time,
.mail__text {
    color: var(--tao-color-text-muted);
    font-size: 13px;
}

.mail__subject,
.mail__text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.subtitle {
    margin: 24px 0 4px;
    color: var(--tao-color-text-strong);
    font-size: 15px;
}

.muted {
    color: var(--tao-color-text-muted);
    font-size: 12px;
}
</style>
