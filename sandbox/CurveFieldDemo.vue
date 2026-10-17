<script lang="ts" setup>
import { computed, ref } from 'vue';
import { type CurvePoint } from '../src/curveeditor';
import { TaoxCurveField } from '../src/curvefield';
import { tr } from './lang';
import SandboxShell from './SandboxShell.vue';

const size = [{ t: 0, v: 0 }, { t: 0.2, v: 1 }, { t: 1, v: 0 }];
const opacity = [{ t: 0, v: 1 }, { t: 1, v: 0 }];

const a = ref<CurvePoint[]>(size.map((p) => ({ ...p })));
const b = ref<CurvePoint[]>(opacity.map((p) => ({ ...p })));
const c = ref<CurvePoint[]>([{ t: 0, v: 0, ease: 'back-out' }, { t: 0.6, v: 1, ease: { bezier: [0.3, 1.6, 0.7, 1] } }, { t: 1, v: 0.2 }]);

// Labels come from the app: here they are the current page language, to show the prop at work.
// Надписи задаёт приложение: здесь это язык страницы, чтобы показать проп в работе.
const custom = computed(() => ({
    time: tr('Time, s', 'Время'),
    value: tr('Amount', 'Значение'),
    transition: tr('Easing to the next point', 'Переход к следующей точке'),
    snap: tr('Snap to grid', 'Шаг сетки'),
    remove: tr('Delete point', 'Удалить'),
    reset: tr('Back to default', 'Сбросить'),
    hint: tr('Double-click adds a point, Alt+click or Delete removes it, Shift disables snapping', 'Двойной клик добавляет точку, Alt+клик или Delete убирает, Shift без шага'),
}));
</script>

<template>
    <SandboxShell title="curvefield" :note="tr('A curve with fields: the plot from curveeditor, point fields, transition to the next point (ease), grid step, remove and reset. The app supplies the labels through labels.', 'Кривая с полями: график из curveeditor, поля точки, переход к следующей точке (ease), шаг сетки, удаление и сброс. Надписи задаёт приложение через labels.')">
        <div class="grid">
            <section class="case">
                <h2>{{ tr('Size, min 0', 'Размер, min 0') }} <small>{{ tr('default English labels, with reset', 'по умолчанию английские надписи, есть сброс') }}</small></h2>
                <TaoxCurveField v-model="a" :min="0" :default-value="size" :precision="2" />
                <pre>{{ JSON.stringify(a) }}</pre>
            </section>
            <section class="case">
                <h2>{{ tr('Opacity, 0…1', 'Непрозрачность, 0…1') }} <small>{{ tr('your own labels through labels', 'свои надписи через labels') }}</small></h2>
                <TaoxCurveField v-model="b" :min="0" :max="1" :default-value="opacity" :labels="custom" />
                <pre>{{ JSON.stringify(b) }}</pre>
            </section>
            <section class="case">
                <h2>{{ tr('Transitions', 'Переходы') }} <small>{{ tr('back-out and an overshooting Bezier: the scale grows with the handles', 'back-out и Безье с заступом: шкала растёт вместе с ручками') }}</small></h2>
                <TaoxCurveField v-model="c" :min="0" />
                <pre>{{ JSON.stringify(c) }}</pre>
            </section>
        </div>
    </SandboxShell>
</template>
