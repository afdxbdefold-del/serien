import bcrypt from 'bcryptjs';

if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
  process.stderr.write('Bitte in einem interaktiven Terminal ausführen.\n');
  process.exit(1);
}

process.stdout.write('Editor-Passwort eingeben (Eingabe bleibt unsichtbar): ');
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

let password = '';
process.stdin.on('data', async chunk => {
  for (const character of chunk) {
    if (character === '\u0003') {
      process.stdin.setRawMode(false);
      process.stdout.write('\n');
      process.exit(130);
    }
    if (character === '\r' || character === '\n') {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (password.length < 8) {
        process.stderr.write('Mindestens 8 Zeichen erforderlich; 12 oder mehr empfohlen.\n');
        process.exitCode = 1;
        return;
      }
      const hash = await bcrypt.hash(password, 12);
      password = '';
      process.stdout.write(`${hash}\n`);
      return;
    }
    if (character === '\u007f' || character === '\b') password = password.slice(0, -1);
    else if (character >= ' ' && password.length < 200) password += character;
  }
});
