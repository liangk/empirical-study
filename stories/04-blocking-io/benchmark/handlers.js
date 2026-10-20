/**
 * The two true positives benchmarked in the report, as their projects wrote
 * them, plus the async form the solution generator or refactor note points to.
 *
 * - Next.js `decryptWithSecret` (packages/next/src/server/crypto-utils.ts at
 *   e0668e4, MIT): pbkdf2Sync, 100,000 iterations of SHA-512, run on every
 *   request served in Preview Mode (api-utils/node/try-get-preview-data.ts:97).
 * - Redwood dbAuth `hashPassword` (packages/auth-providers/dbAuth/api/src/
 *   shared.ts at a7852fb, MIT): scryptSync with N=2^14, r=8, p=1, run by
 *   DbAuthHandler on every login (_verifyPassword, DbAuthHandler.ts:1376),
 *   signup and password reset.
 *
 * The async forms differ only in the KDF call: same parameters, same output.
 */
const crypto = require('crypto');

// --- Next.js crypto-utils.ts, verbatim apart from types ---------------------
const CIPHER_ALGORITHM = 'aes-256-gcm';
const CIPHER_KEY_LENGTH = 32;
const CIPHER_IV_LENGTH = 16;
const CIPHER_TAG_LENGTH = 16;
const CIPHER_SALT_LENGTH = 64;
const PBKDF2_ITERATIONS = 100_000;

function encryptWithSecret(secret, data) {
  const iv = crypto.randomBytes(CIPHER_IV_LENGTH);
  const salt = crypto.randomBytes(CIPHER_SALT_LENGTH);
  const key = crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, CIPHER_KEY_LENGTH, 'sha512');
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
}

function split(encryptedData) {
  const buffer = Buffer.from(encryptedData, 'hex');
  const salt = buffer.slice(0, CIPHER_SALT_LENGTH);
  const iv = buffer.slice(CIPHER_SALT_LENGTH, CIPHER_SALT_LENGTH + CIPHER_IV_LENGTH);
  const tag = buffer.slice(CIPHER_SALT_LENGTH + CIPHER_IV_LENGTH, CIPHER_SALT_LENGTH + CIPHER_IV_LENGTH + CIPHER_TAG_LENGTH);
  const encrypted = buffer.slice(CIPHER_SALT_LENGTH + CIPHER_IV_LENGTH + CIPHER_TAG_LENGTH);
  return { salt, iv, tag, encrypted };
}

function decipher(key, iv, tag, encrypted) {
  const d = crypto.createDecipheriv(CIPHER_ALGORITHM, key, iv);
  d.setAuthTag(tag);
  return d.update(encrypted) + d.final('utf8');
}

/** As shipped. */
function decryptWithSecret(secret, encryptedData) {
  const { salt, iv, tag, encrypted } = split(encryptedData);
  const key = crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, CIPHER_KEY_LENGTH, 'sha512');
  return decipher(key, iv, tag, encrypted);
}

/** The generator's rewrite of the pbkdf2Sync call, in an async function. */
async function decryptWithSecretAsync(secret, encryptedData) {
  const { salt, iv, tag, encrypted } = split(encryptedData);
  const key = await new Promise((resolve, reject) => crypto.pbkdf2(secret, salt, PBKDF2_ITERATIONS, CIPHER_KEY_LENGTH, 'sha512', (err, k) => (err ? reject(err) : resolve(k))));
  return decipher(key, iv, tag, encrypted);
}

// --- Redwood dbAuth shared.ts hashPassword ----------------------------------
const DEFAULT_SCRYPT_OPTIONS = { cost: 2 ** 14, blockSize: 8, parallelization: 1 };

/** As shipped. */
function hashPassword(text, { salt = crypto.randomBytes(32).toString('hex'), options = DEFAULT_SCRYPT_OPTIONS } = {}) {
  const encryptedString = crypto.scryptSync(text.normalize('NFC'), salt, 32, options).toString('hex');
  const optionsToString = [options.cost, options.blockSize, options.parallelization];
  return [`${encryptedString}|${optionsToString.join('|')}`, salt];
}

/** Async scrypt, same parameters. */
async function hashPasswordAsync(text, { salt = crypto.randomBytes(32).toString('hex'), options = DEFAULT_SCRYPT_OPTIONS } = {}) {
  const key = await new Promise((resolve, reject) => crypto.scrypt(text.normalize('NFC'), salt, 32, options, (err, k) => (err ? reject(err) : resolve(k))));
  const optionsToString = [options.cost, options.blockSize, options.parallelization];
  return [`${key.toString('hex')}|${optionsToString.join('|')}`, salt];
}

module.exports = { encryptWithSecret, decryptWithSecret, decryptWithSecretAsync, hashPassword, hashPasswordAsync };
