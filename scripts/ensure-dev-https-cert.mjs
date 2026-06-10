import { ensureHttpsCertificate } from './dev-https-cert.mjs';

const httpsEnabled = process.env.WEB_HTTPS === '1';

if (!httpsEnabled) {
  process.exit(0);
}

const certPath = process.env.WEB_HTTPS_CERT;
const keyPath = process.env.WEB_HTTPS_KEY;
const san = process.env.WEB_HTTPS_SAN;

if (!certPath || !keyPath || !san) {
  console.error(
    'WEB_HTTPS=1 requires WEB_HTTPS_CERT, WEB_HTTPS_KEY and WEB_HTTPS_SAN to be set',
  );
  process.exit(1);
}

try {
  const result = ensureHttpsCertificate({
    certPath,
    httpsEnabled,
    keyPath,
    san,
  });

  if (result.generator === 'mkcert' && result.changed) {
    console.log(`[dev-restart] Generated trusted mkcert certificate: ${certPath}`);
  } else if (result.generator === 'openssl' && result.changed) {
    console.log(`[dev-restart] Generated self-signed certificate: ${certPath}`);
  }

  if (result.warning) {
    console.log(`[dev-restart] WARNING: ${result.warning}`);
  }
} catch (error) {
  console.error(
    `[dev-restart] ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}
