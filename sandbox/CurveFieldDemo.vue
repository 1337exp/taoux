<script lang="ts" setup>
import { ref } from 'vue';
import { type CurvePoint } from '../src/curveeditor';
import { TaoxCurveField } from '../src/curvefield';
import SandboxShell from './SandboxShell.vue';

const size = [{ t: 0, v: 0 }, { t: 0.2, v: 1 }, { t: 1, v: 0 }];
const opacity = [{ t: 0, v: 1 }, { t: 1, v: 0 }];

const a = ref<CurvePoint[]>(size.map((p) => ({ ...p })));
const b = ref<CurvePoint[]>(opacity.map((p) => ({ ...p })));
const c = ref<CurvePoint[]>([{ t: 0, v: 0, ease: 'back-out' }, { t: 0.6, v: 1, ease: { bezier: [0.3, 1.6, 0.7, 1] } }, { t: 1, v: 0.2 }]);

const russian = {
    time: 'Время',
    value: 'Значение',
    transition: 'Переход к следующей точке',
    snap: 'Шаг сетки',
    remove: 'Удалить',
    reset: 'Сбросить',
    hint: 'Двойной клик добавляет точку, Alt+клик или Delete убирает, Shift без шага',
};
</script>

<template>
    <SandboxShell title="curvefield" note="Кривая с полями: график из curveeditor, поля точки, переход к следующей точке (ease), шаг сетки, удаление и сброс. Надписи задаёт приложение через labels.">
        <div class="grid">
            <section class="case">
                <h2>Размер, min 0 <small>по умолчанию английские надписи, есть сброс</small></h2>
                <TaoxCurveField v-model="a" :min="0" :default-value="size" :precision="2" />
                <pre>{{ JSON.stringify(a) }}</pre>
            </section>
            <section class="case">
                <h2>Непрозрачность, 0…1 <small>русские надписи через labels</small></h2>
                <TaoxCurveField v-model="b" :min="0" :max="1" :default-value="opacity" :labels="russian" />
                <pre>{{ JSON.stringify(b) }}</pre>
            </section>
            <section class="case">
                <h2>Переходы <small>back-out и Безье с заступом: шкала растёт вместе с ручками</small></h2>
                <TaoxCurveField v-model="c" :min="0" />
                <pre>{{ JSON.stringify(c) }}</pre>
            </section>
        </div>
    </SandboxShell>
</template>
