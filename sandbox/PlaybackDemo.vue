<script lang="ts" setup>
import { TaoSegmented, TaoSegmentedOption, TaoSwitch, TaoTimeline } from '@1337exp/taoui';
import { computed, ref, watch } from 'vue';
import { usePlayback } from '../src/playback';
import { tr } from './lang';
import SandboxShell from './SandboxShell.vue';

// TaoUX drives the time (usePlayback), TaoUI draws it (TaoTimeline): they do not know each other, the glue is two v-models. / TaoUX ведёт время (usePlayback), TaoUI рисует (TaoTimeline): друг про друга они не знают, склейка это два v-model.
const LENGTH = 8;
const clip = usePlayback({ length: LENGTH, time: 1.25 });
const events = computed(() => [0, 2, 4, 6].map((value) => ({ value, label: `${value} ${tr('s', 'с')}` })));
const seconds = (t: number) => `${t.toFixed(2)} ${tr('s', 'с')}`;

const speed = ref('1');
watch(speed, (v) => clip.playback.setSpeed(Number(v)));

// Второй таймлайн на той же модели: шкала сверху и толстый трек, оба показывают одно время
const state = computed(() => JSON.stringify({ time: Number(clip.time.value.toFixed(2)), playing: clip.playing.value, loop: clip.loop.value, speed: clip.speed.value, progress: Number(clip.progress.value.toFixed(3)) }));
</script>

<template>
    <SandboxShell title="playback" :note="tr('usePlayback from taoux drives the time, TaoTimeline from TaoUI shows it and takes the actions. The two sides are joined by two v-models only. Time advances by browser frames; at the end without a loop playback stops, and “play” from there starts over.', 'usePlayback из taoux ведёт время, TaoTimeline из TaoUI показывает и принимает действия. Обе стороны связаны только двумя v-model. Время ведётся по кадрам браузера; на конце без цикла воспроизведение останавливается, а «играть» оттуда начинает сначала.')">
        <div class="grid" style="grid-template-columns: 1fr">
            <section class="case">
                <h2>TaoTimeline <small>{{ tr('v-model=time, v-model:playing, event marks', 'v-model=time, v-model:playing, метки событий') }}</small></h2>
                <TaoTimeline v-model="clip.time.value" v-model:playing="clip.playing.value" :length="LENGTH" :marks="events" :format="seconds" />
                <div class="row">
                    <TaoSwitch v-model="clip.loop.value" :label="tr('Loop', 'Цикл')" />
                    <TaoSegmented v-model="speed" size="small">
                        <TaoSegmentedOption value="0.25" label="0.25×" />
                        <TaoSegmentedOption value="0.5" label="0.5×" />
                        <TaoSegmentedOption value="1" label="1×" />
                        <TaoSegmentedOption value="2" label="2×" />
                    </TaoSegmented>
                </div>
            </section>

            <section class="case">
                <h2>{{ tr('The same data, another look', 'Те же данные, другой вид') }} <small>{{ tr('scale on top, thick track, no "to start"', 'шкала сверху, толстый трек, без «в начало»') }}</small></h2>
                <TaoTimeline v-model="clip.time.value" v-model:playing="clip.playing.value" :length="LENGTH" :marks="events" marks-side="start" variant="bar" size="small" :show-restart="false" :format="seconds" />
            </section>

            <section class="case">
                <h2>{{ tr('Do not follow while scrubbing', 'Не вести при перемотке') }} <small>{{ tr('pause-on-scrub is off: you drag, time keeps running', 'pause-on-scrub выключен: тянешь, а время идёт') }}</small></h2>
                <TaoTimeline v-model="clip.time.value" v-model:playing="clip.playing.value" :length="LENGTH" :pause-on-scrub="false" :show-time="false" />
            </section>
        </div>
        <pre class="muted" style="margin-top: 16px; font-size: 11px">{{ state }}</pre>
    </SandboxShell>
</template>
