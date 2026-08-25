import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : path.endsWith('.js') ? [path] : [];
  }));
  return files.flat();
}

test('api directory stays within the Vercel Hobby function-file limit', async () => {
  const files = await javascriptFiles(resolve('api'));
  assert.ok(files.length <= 12, `Found ${files.length} JavaScript files in api/; Vercel Hobby allows at most 12. Move shared handlers outside api/.`);
});
