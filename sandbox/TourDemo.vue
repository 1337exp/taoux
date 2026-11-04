<script lang="ts" setup>
import { TaoButton, TaoCard, TaoSwitch, TaoTour, type TaoTourStep } from '@1337exp/taoui';
import { computed, ref } from 'vue';
import { createTourMemory, useTour } from '../src/tour';
import { tr } from './lang';
import SandboxShell from './SandboxShell.vue';

// TaoUX keeps the tour (useTour: where we are, next / prev / skip, steps whose target is gone are jumped over),
// TaoUI draws it (TaoTour: the lit window and the card). They do not know each other: the glue is the props and the events.
// TaoUX ведёт тур (useTour: где мы, next / prev / skip, шаги без цели перепрыгиваются), TaoUI рисует (TaoTour: окно и карточка).
// Друг о друге они не знают: клей — пропсы и события.

const shareOn = ref(true);
const log = ref<string[]>([]);

const steps = computed<TaoTourStep[]>(() => [
    { id: 'hi', title: tr('A quick look', 'Быстрый обзор'), text: tr('Four things to know. The arrows or the buttons move on, Esc leaves.', 'Четыре вещи, которые стоит знать. Стрелки или кнопки ведут дальше, Esc выходит.') },
    { id: 'new', target: '#t-new', placement: 'bottom', title: tr('Start here', 'Начните здесь'), text: tr('A new project begins with this button.', 'Новый проект начинается с этой кнопки.') },
    { id: 'share', target: '#t-share', placement: 'bottom', title: tr('Share', 'Поделиться'), text: tr('This step is jumped over when the button is not on the page: switch it off below and run the tour again.', 'Этот шаг пропускается, когда кнопки нет на странице: выключите её ниже и запустите тур снова.') },
    { id: 'list', target: '#t-list', placement: 'right', title: tr('Your projects', 'Ваши проекты'), text: tr('Everything you made is here.', 'Здесь всё, что вы сделали.') },
    { id: 'try', target: '#t-switch', placement: 'top', title: tr('Try it', 'Попробуйте'), text: tr('This step is interactive: the switch really works while the tour runs.', 'Этот шаг интерактивный: переключатель по-настоящему работает, пока идёт тур.') },
]);

// a step can be shown only if its target is on the page / шаг можно показать, только если его цель есть на странице
const available = (step: TaoTourStep) => !step.target || document.querySelector(step.target as string) !== null;

const memory = createTourMemory('taoux.sandbox.tour');
const seen = ref(memory.seen());

const tour = useTour<TaoTourStep>({
    steps: steps.value,
    available,
    onEnd: (reason, step) => {
        log.value.unshift(`${reason} @ ${step?.id ?? '—'}`);
        seen.value = memory.markSeen() || seen.value;
    },
});

const interactive = computed(() => tour.step.value?.id === 'try');

function start() {
    // the texts follow the language, so the steps are handed over again / тексты идут за языком, поэтому шаги передаются заново
    tour.setSteps(steps.value);
    tour.start();
}

function forget() {
    memory.reset();
    seen.value = false;
}

const on = ref(false);
const items = computed(() => [tr('Landing page', 'Лендинг'), tr('Mobile app', 'Мобильное приложение'), tr('Pitch deck', 'Питч')]);
</script>

<template>
    <SandboxShell
        title="tour"
        :note="tr('useTour from taoux keeps the steps, TaoTour from TaoUI draws them. A step whose target is not on the page is jumped over, and the tour remembers that it was seen.', 'useTour из taoux ведёт шаги, TaoTour из TaoUI их рисует. Шаг, цели которого нет на странице, перепрыгивается, а тур помнит, что его уже видели.')"
    >
        <div class="grid" style="grid-template-columns: 1fr">
            <section class="case">
                <h2>{{ tr('A small app to walk through', 'Маленькое приложение для обхода') }} <small>{{ tr('useTour + TaoTour', 'useTour + TaoTour') }}</small></h2>
                <div class="app">
                    <div class="app__bar">
                        <TaoButton id="t-new" size="small" icon="tao-plus">{{ tr('New', 'Создать') }}</TaoButton>
                        <TaoButton v-if="shareOn" id="t-share" size="small" variant="secondary">{{ tr('Share', 'Поделиться') }}</TaoButton>
                    </div>
                    <TaoCard id="t-list" :title="tr('Projects', 'Проекты')" class="app__list">
                        <ul>
                            <li v-for="item in items" :key="item">{{ item }}</li>
                        </ul>
                    </TaoCard>
                    <span id="t-switch"><TaoSwitch v-model="on" :label="tr('A real switch', 'Настоящий переключатель')" /></span>
                </div>
                <div class="row">
                    <TaoButton @click="start">{{ tr('Start the tour', 'Начать тур') }}</TaoButton>
                    <TaoSwitch v-model="shareOn" :label="tr('The Share button is on the page', 'Кнопка «Поделиться» на странице')" />
                </div>
            </section>

            <section class="case">
                <h2>{{ tr('Show it once', 'Показать один раз') }} <small>createTourMemory</small></h2>
                <div class="row">
                    <span class="muted">{{ seen ? tr('The tour was seen: it would not come back by itself.', 'Тур уже видели: сам он бы не вернулся.') : tr('Not seen yet: a first-time visitor would get it.', 'Ещё не видели: новый посетитель получил бы его.') }}</span>
                    <TaoButton size="small" variant="secondary" :disabled="!seen" @click="forget">{{ tr('Forget', 'Забыть') }}</TaoButton>
                </div>
                <pre>{{ log.length ? log.join('\n') : tr('onEnd: the tour has not ended yet', 'onEnd: тур ещё не закончился') }}</pre>
            </section>
        </div>

        <TaoTour
            :step="tour.step.value"
            :index="tour.position.value"
            :count="tour.total.value"
            :first="tour.first.value"
            :last="tour.last.value"
            :interactive="interactive"
            @next="tour.next"
            @prev="tour.prev"
            @skip="tour.skip"
        />
    </SandboxShell>
</template>

<style scoped>
.app {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
    padding: 16px;
    border: 1px dashed var(--tao-color-border-strong);
    border-radius: 8px;
}

.app__bar {
    display: flex;
    gap: 8px;
}

.app__list {
    width: 260px;
}

.app__list ul {
    margin: 0;
    padding-left: 18px;
}
</style>
