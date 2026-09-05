import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const domains = require('disposable-email-domains');

const disposableSet = new Set(domains);

export function isDisposableEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? disposableSet.has(domain) : false;
}
