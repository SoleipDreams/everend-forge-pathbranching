import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'vite';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

// Build precisely the entry that desktop hosts import. App.tsx and its lazy CSS
// must not be needed to render a detached window, and no artifacts are written.
const result = await build({
  root, configFile: false, logLevel: 'silent',
  build: {
    write: false, minify: false,
    lib: { entry: path.join(root, 'src/components/StoryTestDetached.tsx'), formats: ['es'] },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
      output: { paths: id => pathToFileURL(require.resolve(id)).href },
    },
  },
});
const output = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
const chunks = output.filter(item => item.type === 'chunk');
const entry = chunks.find(item => item.isEntry);
assert.ok(entry, 'the detached entry must build independently');
const { StoryTestDetached } = await import(`data:text/javascript;base64,${Buffer.from(entry.code).toString('base64')}`);

test('direct desktop mounting owns one scoped root for Play Mode and Debug', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: '?session=detached-entry-fixture' } };
  try {
    for (const kind of ['preview', 'debug']) {
      const html = renderToStaticMarkup(createElement(StoryTestDetached, { kind }));
      assert.equal((html.match(/class="pathbranching-app /g) ?? []).length, 1);
      assert.match(html, /^<div class="pathbranching-app story-test-detached-app" data-theme="worldnotion-dark"><main class="story-test-detached-shell"/);
      assert.ok(html.includes(`data-testid="story-test-detached-${kind}"`));
      assert.match(html, /data-tauri-drag-region="true"/);
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('the independent entry ships palette, semantic tokens, playback and window styles', () => {
  const css = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source).join('\n');
  assert.ok(css.length, 'detached entry must include its own stylesheet');
  for (const marker of ['--wn-panel:', '--ef-ui-font:', '--ef-radius-control:', '.story-test-controls', '.story-test-content', '.story-test-detached-shell', '@scope (.pathbranching-app)']) {
    assert.ok(css.includes(marker), `missing detached style: ${marker}`);
  }
  assert.match(css, /font-family:\s*var\(--ef-ui-font/);
  assert.match(css, /font-family:\s*var\(--ef-primary-font/);
  assert.ok(chunks.every(chunk => Object.keys(chunk.modules).every(id => !/[\\/]src[\\/]App\.tsx$/.test(id))), 'the detached entry must not load the main editor');
});
