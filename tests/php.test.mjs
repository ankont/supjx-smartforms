import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const phpArgs = [];
if (process.platform === 'win32') {
  const binary = spawnSync('php', ['-r', 'echo PHP_BINARY;'], { encoding: 'utf8' }).stdout;
  const ext = join(dirname(binary), 'ext');
  if (existsSync(ext)) phpArgs.push('-d', `extension_dir=${ext}`, '-d', 'extension=mbstring', '-d', 'extension=mysqli');
}

for (const file of ['directives.php', 'list-notes.php', 'joomla-lifecycle.php', 'extended-lifecycle.php']) {
  test(file, () => {
    const result = spawnSync('php', [...phpArgs, `tests/${file}`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
