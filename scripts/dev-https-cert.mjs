import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

const opensslPreviewWarning =
  'WEB_HTTPS is falling back to an OpenSSL self-signed certificate. ' +
  'The app can still load, but embedded VS Code Web webviews, image previews ' +
  'and PNG previews may fail until the browser trusts the certificate. ' +
  'Install mkcert for trusted local HTTPS, provide your own trusted cert, ' +
  'or use WEB_HTTPS=0 for localhost-only debugging.';

function splitSanEntries(san) {
  return san
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractMkcertNames(san) {
  return splitSanEntries(san)
    .map((entry) => entry.replace(/^(DNS|IP):/i, '').trim())
    .filter(Boolean);
}

function runCommand(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function commandExists(commandName) {
  try {
    execFileSync('which', [commandName], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function resolveHttpsCertStrategy({ httpsEnabled, mkcertAvailable }) {
  if (!httpsEnabled) {
    return {
      generator: 'none',
      warning: null,
    };
  }

  if (mkcertAvailable) {
    return {
      generator: 'mkcert',
      warning: null,
    };
  }

  return {
    generator: 'openssl',
    warning: opensslPreviewWarning,
  };
}

export function certificateMatchesRequestedSan(certPath, requestedSan) {
  if (!existsSync(certPath)) {
    return false;
  }

  let certificateText = '';
  try {
    certificateText = runCommand('openssl', [
      'x509',
      '-in',
      certPath,
      '-noout',
      '-text',
    ]);
  } catch {
    return false;
  }

  return splitSanEntries(requestedSan).every((entry) =>
    certificateText.includes(entry),
  );
}

function generateWithOpenSsl({ certPath, keyPath, san }) {
  runCommand('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-nodes',
    '-days',
    '365',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-subj',
    '/CN=localhost',
    '-addext',
    `subjectAltName=${san}`,
  ]);
}

function generateWithMkcert({ certPath, keyPath, san }) {
  const names = extractMkcertNames(san);
  if (names.length === 0) {
    throw new Error('No SAN names were provided for mkcert generation');
  }

  runCommand('mkcert', ['-cert-file', certPath, '-key-file', keyPath, ...names]);
}

export function ensureHttpsCertificate({
  httpsEnabled,
  certPath,
  keyPath,
  san,
  mkcertAvailable = commandExists('mkcert'),
  opensslAvailable = commandExists('openssl'),
}) {
  if (!httpsEnabled) {
    return {
      changed: false,
      generator: 'none',
      warning: null,
    };
  }

  if (!opensslAvailable) {
    throw new Error('WEB_HTTPS=1 requires openssl, but openssl is not installed');
  }

  if (existsSync(certPath) && existsSync(keyPath)) {
    if (certificateMatchesRequestedSan(certPath, san)) {
      return {
        changed: false,
        generator: 'existing',
        warning: null,
      };
    }

    rmSync(certPath, { force: true });
    rmSync(keyPath, { force: true });
  }

  mkdirSync(dirname(certPath), { recursive: true });
  mkdirSync(dirname(keyPath), { recursive: true });

  const strategy = resolveHttpsCertStrategy({
    httpsEnabled,
    mkcertAvailable,
  });

  if (strategy.generator === 'mkcert') {
    try {
      generateWithMkcert({ certPath, keyPath, san });
      return {
        changed: true,
        generator: 'mkcert',
        warning: null,
      };
    } catch (error) {
      generateWithOpenSsl({ certPath, keyPath, san });
      return {
        changed: true,
        generator: 'openssl',
        warning:
          `${opensslPreviewWarning} ` +
          `mkcert failed and the script fell back to OpenSSL: ${
            error instanceof Error ? error.message : String(error)
          }`,
      };
    }
  }

  generateWithOpenSsl({ certPath, keyPath, san });
  return {
    changed: true,
    generator: 'openssl',
    warning: strategy.warning,
  };
}
