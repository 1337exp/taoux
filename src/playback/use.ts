import { computed, onBeforeUnmount, reactive, toRefs, type ComputedRef, type WritableComputedRef } from 'vue';
import { createPlayback, type Playback, type PlaybackOptions } from './core';

export interface UsePlayback {
    /** Время, с. Запись перематывает (`v-model` у таймлайна). */
    time: WritableComputedRef<number>;
    /** Идёт ли воспроизведение. Запись включает и выключает (`v-model:playing`). */
    playing: WritableComputedRef<boolean>;
    length: ComputedRef<number>;
    loop: WritableComputedRef<boolean>;
    speed: WritableComputedRef<number>;
    /** Доля пройденного 0…1. */
    progress: ComputedRef<number>;
    play(): void;
    pause(): void;
    toggle(): void;
    restart(): void;
    seek(time: number): void;
    setLength(length: number): void;
    /** Модель без Vue: для случаев, когда нужен её полный API (advance, subscribe). */
    playback: Playback;
}

/** Воспроизведение для компонента Vue: реактивные время и состояние поверх `createPlayback`; при размонтировании останавливается. */
export function usePlayback(options: PlaybackOptions): UsePlayback {
    const playback = createPlayback(options);
    const state = reactive({ time: playback.time, length: playback.length, playing: playback.playing, loop: playback.loop, speed: playback.speed });
    const stop = playback.subscribe((s) => Object.assign(state, s));
    onBeforeUnmount(() => {
        stop();
        playback.dispose();
    });

    const refs = toRefs(state);
    return {
        time: computed({ get: () => refs.time.value, set: (v) => playback.seek(v) }),
        playing: computed({ get: () => refs.playing.value, set: (v) => (v ? playback.play() : playback.pause()) }),
        length: computed(() => refs.length.value),
        loop: computed({ get: () => refs.loop.value, set: (v) => playback.setLoop(v) }),
        speed: computed({ get: () => refs.speed.value, set: (v) => playback.setSpeed(v) }),
        progress: computed(() => (refs.length.value > 0 ? refs.time.value / refs.length.value : 0)),
        play: playback.play,
        pause: playback.pause,
        toggle: playback.toggle,
        restart: playback.restart,
        seek: playback.seek,
        setLength: playback.setLength,
        playback,
    };
}
