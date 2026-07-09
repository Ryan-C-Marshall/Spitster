import { spawn } from 'node:child_process';

const workspaces = [
  { name: 'api', args: ['run', 'dev', '--workspace=@spitster/api'] },
  { name: 'web', args: ['run', 'dev', '--workspace=@spitster/web'] },
];

const children = workspaces.map(({ name, args }) => {
  const child = spawn('npm', args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  return child;
});

const shutdown = (exitCode = 0) => {
  for (const child of children) {
    child.kill('SIGTERM');
  }

  process.exit(exitCode);
};

for (const child of children) {
  child.on('exit', (code) => {
    shutdown(code ?? 0);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));