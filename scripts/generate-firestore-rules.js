/**
 * Generate firestore.rules from firestore.rules.template.
 *
 * Reads VITE_ADMIN_EMAIL from .env (or falls back to the default),
 * substitutes {{VITE_ADMIN_EMAIL}} in the template, and writes firestore.rules.
 *
 * Usage:  node scripts/generate-firestore-rules.js
 *         npm run build:rules
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Read .env if it exists
let adminEmail = 's19800430@gmail.com'; // default fallback
const envPath = resolve(ROOT, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_ADMIN_EMAIL=')) {
      const val = trimmed.split('=').slice(1).join('=').trim();
      if (val) adminEmail = val;
      break;
    }
  }
} else {
  console.warn('⚠️  No .env file found. Using default admin email: ' + adminEmail);
  console.warn('   Copy .env.example → .env and set VITE_ADMIN_EMAIL to customize.');
}

// Read template, substitute, write firestore.rules
const templatePath = resolve(ROOT, 'firestore.rules.template');
const rulesPath = resolve(ROOT, 'firestore.rules');

const template = readFileSync(templatePath, 'utf-8');
const rules = template.replace(/\{\{VITE_ADMIN_EMAIL\}\}/g, adminEmail);
writeFileSync(rulesPath, rules, 'utf-8');

console.log('✅ Generated firestore.rules with admin email: ' + adminEmail);
