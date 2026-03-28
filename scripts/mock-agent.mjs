import readline from 'node:readline';

function emit(line) {
  process.stdout.write(`${line}\n`);
}

emit('Mock agent booting...');
emit('Ready for your next instruction.');
emit('Awaiting input');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  const value = line.trim();

  if (!value) {
    emit('Awaiting input');
    return;
  }

  if (value === 'exit') {
    emit('Mock agent shutting down.');
    process.exit(0);
  }

  emit(`Received instruction: ${value}`);
  emit(`Processed: ${value.toUpperCase()}`);
  emit('Awaiting input');
});