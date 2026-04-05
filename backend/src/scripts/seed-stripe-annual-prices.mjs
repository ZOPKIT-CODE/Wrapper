/**
 * One-time helper: create 3 annual subscription products in Stripe (USD + INR each)
 * and append price IDs to backend/.env
 *
 * Usage: from repo root
 *   node --import dotenv/config backend/src/scripts/seed-stripe-annual-prices.mjs
 *
 * Requires STRIPE_SECRET_KEY in backend/.env (or env). Skips if yearly price IDs already set.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '../..');
const envPath = path.join(backendRoot, '.env');

const PLANS = [
  {
    key: 'starter',
    name: 'Wrapper Suite — Starter',
    description: 'Annual subscription — Starter plan',
    usdCents: 120_00,
    inrPaise: 9999_00,
  },
  {
    key: 'professional',
    name: 'Wrapper Suite — Professional',
    description: 'Annual subscription — Professional plan',
    usdCents: 240_00,
    inrPaise: 19999_00,
  },
  {
    key: 'enterprise',
    name: 'Wrapper Suite — Enterprise',
    description: 'Annual subscription — Enterprise plan',
    usdCents: 360_00,
    inrPaise: 29999_00,
  },
];

function envVarUsd(key) {
  return `STRIPE_${key.toUpperCase()}_YEARLY_PRICE_ID`;
}
function envVarInr(key) {
  return `STRIPE_${key.toUpperCase()}_YEARLY_INR_PRICE_ID`;
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error('Missing STRIPE_SECRET_KEY. Set it in backend/.env and retry.');
    process.exit(1);
  }

  const already =
    process.env.STRIPE_STARTER_YEARLY_PRICE_ID &&
    process.env.STRIPE_STARTER_YEARLY_INR_PRICE_ID &&
    process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID &&
    process.env.STRIPE_PROFESSIONAL_YEARLY_INR_PRICE_ID &&
    process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID &&
    process.env.STRIPE_ENTERPRISE_YEARLY_INR_PRICE_ID;

  if (already && process.argv.includes('--force') === false) {
    console.log('All six STRIPE_*_YEARLY*_PRICE_ID variables are already set. Use --force to create duplicates.');
    process.exit(0);
  }

  const stripe = new Stripe(secret, { apiVersion: '2023-10-16', timeout: 20_000 });

  const lines = ['', `# Stripe annual prices — ${new Date().toISOString()}`];

  for (const p of PLANS) {
    const product = await stripe.products.create({
      name: p.name,
      description: p.description,
      metadata: { wrapper_plan: p.key, billing: 'annual' },
    });

    const priceUsd = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: p.usdCents,
      recurring: { interval: 'year' },
      metadata: { wrapper_plan: p.key },
    });

    const priceInr = await stripe.prices.create({
      product: product.id,
      currency: 'inr',
      unit_amount: p.inrPaise,
      recurring: { interval: 'year' },
      metadata: { wrapper_plan: p.key },
    });

    console.log(`${p.key}: product=${product.id} usd=${priceUsd.id} inr=${priceInr.id}`);

    lines.push(`${envVarUsd(p.key)}=${priceUsd.id}`);
    lines.push(`${envVarInr(p.key)}=${priceInr.id}`);
  }

  if (fs.existsSync(envPath)) {
    fs.appendFileSync(envPath, `\n${lines.join('\n')}\n`, 'utf8');
    console.log(`\nAppended price IDs to ${envPath}`);
  } else {
    console.log('\nCopy into backend/.env:\n');
    console.log(lines.join('\n'));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
