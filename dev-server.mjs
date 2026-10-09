import { spawn, execSync } from 'child_process';

// Ensure any stale process on port 3000 is terminated before launching
try {
  const output = execSync("ss -lptn 'sport = :3000' 2>/dev/null || true").toString();
  const match = output.match(/pid=(\d+)/);
  if (match && match[1] && match[1] !== String(process.pid)) {
    try {
      process.kill(Number(match[1]), 'SIGKILL');
    } catch (_) {}
  }
} catch (_) {}

const rawArgs = process.argv.slice(2);
const nextArgs = ['dev'];

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === '--host') {
    const val = rawArgs[i + 1];
    if (val && !val.startsWith('-')) {
      nextArgs.push('-H', val);
      i++;
    } else {
      nextArgs.push('-H', '0.0.0.0');
    }
  } else if (arg.startsWith('--host=')) {
    nextArgs.push('-H', arg.split('=')[1] || '0.0.0.0');
  } else if (arg === '--port' || arg === '-p') {
    const val = rawArgs[i + 1];
    if (val && !val.startsWith('-')) {
      nextArgs.push('-p', val);
      i++;
    } else {
      nextArgs.push('-p', '3000');
    }
  } else if (arg.startsWith('--port=')) {
    nextArgs.push('-p', arg.split('=')[1] || '3000');
  } else {
    nextArgs.push(arg);
  }
}

if (!nextArgs.includes('-p')) {
  nextArgs.push('-p', process.env.PORT || '3000');
}
if (!nextArgs.includes('-H')) {
  nextArgs.push('-H', '0.0.0.0');
}

const child = spawn('npx', ['next', ...nextArgs], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
