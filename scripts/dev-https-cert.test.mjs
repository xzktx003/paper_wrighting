import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveHttpsCertStrategy } from './dev-https-cert.mjs';

test('prefers mkcert for embedded VS Code friendly HTTPS when available', () => {
  assert.deepEqual(
    resolveHttpsCertStrategy({
      httpsEnabled: true,
      mkcertAvailable: true,
    }),
    {
      generator: 'mkcert',
      warning: null,
    },
  );
});

test('falls back to openssl and warns about VS Code preview limitations when mkcert is unavailable', () => {
  const result = resolveHttpsCertStrategy({
    httpsEnabled: true,
    mkcertAvailable: false,
  });

  assert.equal(result.generator, 'openssl');
  assert.match(result.warning ?? '', /VS Code Web/i);
  assert.match(result.warning ?? '', /webview|preview|PNG/i);
});

test('does not request any certificate work when HTTPS is disabled', () => {
  assert.deepEqual(
    resolveHttpsCertStrategy({
      httpsEnabled: false,
      mkcertAvailable: true,
    }),
    {
      generator: 'none',
      warning: null,
    },
  );
});
