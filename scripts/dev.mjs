// Режим разработки: пересборка JS (vite) и деклараций (vue-tsc) при правках, чтобы проекты по file:-ссылке видели изменения.
import { spawn } from 'node:child_process';

const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit', shell: true });

const children = [
    run('npx', ['vite', 'build', '--watch']),
    run('npx', ['vue-tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput']),
];

const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', stop));
