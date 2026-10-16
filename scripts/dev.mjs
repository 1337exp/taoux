// Режим разработки: пересборка JS (vite) и деклараций (tsc) при правках, чтобы проекты по `npm link` видели изменения.
import { spawn } from 'node:child_process';

const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit', shell: true });

const children = [
    run('npx', ['vite', 'build', '--watch']),
    run('npx', ['tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput']),
];

const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', stop));
