/**
 * Automated Sequential Supabase Migration Runner for CHERAS CLOTHING POS
 *
 * Sequentially executes all .sql migration files in supabase/migrations/ one-by-one.
 *
 * Supports:
 *   1. Supabase Service Role Key bypass via exec_sql RPC (using @supabase/supabase-js)
 *   2. Direct PostgreSQL connection pooler (Session mode :5432 / Transaction mode :6543)
 *   3. Interactive password prompt or CLI argument
 *   4. Synchronization of supabase/all_migrations_consolidated.sql
 *
 * Usage:
 *   node scripts/run-migrations.cjs [db_password_or_connection_url]
 * Or:
 *   npm run migrate:db [db_password]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

// Read environment variables (strictly read-only)
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const projectRefMatch = SUPABASE_URL.match(/https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
const projectRef = projectRefMatch ? projectRefMatch[1] : '';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const PROPOSED_MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'proposed_migrations');
const CONSOLIDATED_FILE = path.join(__dirname, '..', 'supabase', 'all_migrations_consolidated.sql');

/**
 * Regenerates the consolidated SQL file containing all migrations in order
 * including active production migrations and proposed migrations.
 */
function syncConsolidatedSql(files) {
  let consolidated = '-- ==========================================================================\n';
  consolidated += '-- CHERAS CLOTHING POS - CONSOLIDATED SUPABASE DATABASE MIGRATIONS\n';
  consolidated += '-- Total Production Migrations: ' + files.length + '\n';
  consolidated += '-- Generated: ' + new Date().toISOString() + '\n';
  consolidated += '-- ==========================================================================\n\n';

  // Include admin exec_sql helper
  consolidated += '-- Administrative helper function for service_role migration execution\n';
  consolidated += 'CREATE OR REPLACE FUNCTION public.exec_sql(sql text)\n';
  consolidated += 'RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$\n';
  consolidated += 'BEGIN\n  EXECUTE sql;\nEND;\n$$;\n';
  consolidated += 'GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;\n\n';

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    consolidated += '\n-- ==========================================================================\n';
    consolidated += '-- MIGRATION ' + (i + 1) + ' of ' + files.length + ': ' + f + '\n';
    consolidated += '-- ==========================================================================\n\n';
    consolidated += content.trim() + '\n';
  }

  // Include proposed migrations if present
  if (fs.existsSync(PROPOSED_MIGRATIONS_DIR)) {
    const proposedFiles = fs.readdirSync(PROPOSED_MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (proposedFiles.length > 0) {
      consolidated += '\n\n-- ==========================================================================\n';
      consolidated += '-- ==========================================================================\n';
      consolidated += '-- SECTION: PROPOSED / STAGING MIGRATIONS (supabase/proposed_migrations)\n';
      consolidated += '-- ==========================================================================\n';
      consolidated += '-- ⚠️ IMPORTANT NOTICE FOR SUPABASE SQL EDITOR USERS:\n';
      consolidated += '-- Migrations 1 through ' + files.length + ' above are the active production migrations\n';
      consolidated += '-- required for CHERAS CLOTHING POS (Catalog, Orders, Inventory, Barcodes, Advances,\n';
      consolidated += '-- Expenses, Split Payments, and Customer Birthdays & Offers).\n';
      consolidated += '--\n';
      consolidated += '-- The migration(s) below are PROPOSED DRAFTS that enforce strict least-privilege RLS\n';
      consolidated += '-- by revoking permissions from the anonymous ("anon") role and requiring Supabase\n';
      consolidated += '-- Auth JWT sessions for staff/admin actions.\n';
      consolidated += '-- Because the standard POS terminal operates with client-side credential verification\n';
      consolidated += '-- using the Supabase anonymous client key, executing these statements immediately\n';
      consolidated += '-- will block anonymous POS cashier checkouts (42501 permission denied).\n';
      consolidated += '--\n';
      consolidated += '-- They are preserved in full below, wrapped in a block comment /* ... */ so you\n';
      consolidated += '-- can safely copy and run this entire consolidated file into the Supabase SQL Editor.\n';
      consolidated += '-- If and when you migrate cashiers and admins to Supabase Auth users, remove the\n';
      consolidated += '-- block comment markers to apply these security policies.\n';
      consolidated += '-- ==========================================================================\n\n';

      for (let i = 0; i < proposedFiles.length; i++) {
        const pf = proposedFiles[i];
        const pContent = fs.readFileSync(path.join(PROPOSED_MIGRATIONS_DIR, pf), 'utf8');
        consolidated += '/*\n';
        consolidated += '-- ==========================================================================\n';
        consolidated += '-- PROPOSED MIGRATION ' + (i + 1) + ' of ' + proposedFiles.length + ': ' + pf + '\n';
        consolidated += '-- ==========================================================================\n\n';
        consolidated += pContent.trim() + '\n';
        consolidated += '*/\n';
      }
    }
  }

  fs.writeFileSync(CONSOLIDATED_FILE, consolidated, 'utf8');
  return CONSOLIDATED_FILE;
}

/**
 * Prompt user in terminal for password if not provided
 */
function promptPassword(promptText) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve('');
      return;
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(promptText, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

/**
 * Build candidate PostgreSQL connection strings
 */
function getCandidateConnectionUrls(rawInput) {
  if (rawInput && (rawInput.startsWith('postgres://') || rawInput.startsWith('postgresql://'))) {
    return [rawInput];
  }

  const password = rawInput || process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || '';
  if (!password || !projectRef) return [];

  const encodedPw = encodeURIComponent(password);
  const regions = ['ap-south-1', 'ap-southeast-1', 'us-east-1', 'eu-central-1'];
  const urls = [];

  // Session mode on port 5432 (standard for DDL / schema migrations)
  for (const reg of regions) {
    urls.push({
      label: `Pooler ${reg} (Session mode :5432)`,
      url: `postgres://postgres.${projectRef}:${encodedPw}@aws-0-${reg}.pooler.supabase.com:5432/postgres?sslmode=require`,
    });
  }

  // Transaction mode on port 6543 (fallback)
  for (const reg of regions) {
    urls.push({
      label: `Pooler ${reg} (Transaction mode :6543)`,
      url: `postgres://postgres.${projectRef}:${encodedPw}@aws-0-${reg}.pooler.supabase.com:6543/postgres?sslmode=require`,
    });
  }

  return urls;
}

async function connectPgClient(candidates) {
  for (const item of candidates) {
    const connStr = typeof item === 'string' ? item : item.url;
    const label = typeof item === 'string' ? 'Provided Connection URL' : item.label;

    process.stdout.write(`Connecting to ${label}... `);
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });

    try {
      await client.connect();
      console.log('CONNECTED ✅');
      return client;
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      await client.end().catch(() => {});
    }
  }
  return null;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 CHERAS CLOTHING - SEQUENTIAL SUPABASE MIGRATION RUNNER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Supabase URL      : ${SUPABASE_URL}`);
  console.log(`Project Ref       : ${projectRef || 'unknown'}`);
  console.log(`Service Role Key  : ${SERVICE_ROLE_KEY ? 'Present (Bypasses RLS) ✅' : 'Missing ❌'}`);
  console.log(`Anon Key          : ${ANON_KEY ? 'Present ✅' : 'Missing ❌'}`);

  // 1. Discover all migration files
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`❌ Migrations directory not found at: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`\nFound ${files.length} migration files in supabase/migrations/`);

  // 2. Sync consolidated SQL
  syncConsolidatedSql(files);
  console.log(`Synchronized: supabase/all_migrations_consolidated.sql\n`);

  // 3. Initialize Supabase Client with service_role key to bypass RLS
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 4. Test if exec_sql RPC is available for direct HTTP DDL execution
  console.log('Testing Supabase Service Role exec_sql RPC...');
  let canUseRpc = false;
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
    if (!error) {
      canUseRpc = true;
      console.log('✅ exec_sql RPC is available! Running migrations via Service Role HTTP client.\n');
    } else {
      console.log(`ℹ️  exec_sql RPC not found in schema (${error.message}).`);
    }
  } catch (e) {
    console.log(`ℹ️  exec_sql test skipped: ${e.message}`);
  }

  // 5. Execution path A: via exec_sql RPC
  if (canUseRpc) {
    console.log('🚀 Executing all migrations sequentially via Service Role Key...\n');
    const startTime = Date.now();
    for (let i = 0; i < files.length; i++) {
      const fileName = files[i];
      const filePath = path.join(MIGRATIONS_DIR, fileName);
      const sql = fs.readFileSync(filePath, 'utf8');

      const prefix = `[${String(i + 1).padStart(2, '0')}/${files.length}]`;
      process.stdout.write(`${prefix} Running ${fileName}... `);

      const t0 = Date.now();
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.log(`FAILED ❌`);
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      console.log(`DONE (${Date.now() - t0}ms)`);
    }
    console.log(`\n🎉 All ${files.length} migrations executed successfully in ${Date.now() - startTime}ms!`);
    await verifyDatabase(supabase);
    return;
  }

  // 6. Execution path B: via PostgreSQL Client
  let rawInput = process.argv[2] || process.env.DATABASE_URL || process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || '';

  if (!rawInput && process.stdin.isTTY) {
    console.log('\nDirect PostgreSQL connection requires the Supabase database password.');
    rawInput = await promptPassword('Enter Supabase Database Password (or press Enter to skip): ');
  }

  if (!rawInput) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  ACTION REQUIRED TO APPLY MIGRATIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('The Supabase PostgREST HTTP gateway requires a Postgres connection');
    console.log('or an initial schema run to execute raw DDL (CREATE TABLE) statements.\n');
    console.log('Choose ONE of the following to complete execution:\n');
    console.log('OPTION 1: Run with your database password (CLI automated):');
    console.log('  node scripts/run-migrations.cjs <your_supabase_db_password>');
    console.log('  OR: npm run migrate:db <your_supabase_db_password>\n');
    console.log('OPTION 2: 1-Click execution via Supabase SQL Editor (Fastest):');
    console.log(`  1. Open SQL Editor: https://supabase.com/dashboard/project/${projectRef}/sql`);
    console.log('  2. Open the generated file:');
    console.log('     supabase/all_migrations_consolidated.sql');
    console.log('  3. Paste the contents into the SQL Editor and click "Run".\n');
    console.log('After running Option 2 once, future migrations can also run via');
    console.log('the service_role key automatically because exec_sql is installed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return;
  }

  const candidates = getCandidateConnectionUrls(rawInput);
  const client = await connectPgClient(candidates);

  if (!client) {
    console.error('\n❌ Could not connect to PostgreSQL with the provided password.');
    console.error('Please verify your database password or project reference:');
    console.error(`https://supabase.com/dashboard/project/${projectRef}/settings/database\n`);
    process.exit(1);
  }

  console.log('\n🚀 Executing migrations sequentially one-by-one via PostgreSQL connection...\n');
  const totalStartTime = Date.now();
  let successCount = 0;

  try {
    for (let i = 0; i < files.length; i++) {
      const fileName = files[i];
      const filePath = path.join(MIGRATIONS_DIR, fileName);
      const sql = fs.readFileSync(filePath, 'utf8');

      const prefix = `[${String(i + 1).padStart(2, '0')}/${files.length}]`;
      process.stdout.write(`${prefix} Running ${fileName}... `);

      const startTime = Date.now();
      await client.query(sql);
      const elapsed = Date.now() - startTime;

      console.log(`DONE (${elapsed}ms)`);
      successCount++;
    }

    const totalElapsed = Date.now() - totalStartTime;
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 SUCCESS! All ${successCount} migrations executed sequentially in ${totalElapsed}ms.`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verification
    console.log('🔍 Verifying created tables...');
    const tableRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    const tables = tableRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} public tables:`, tables.join(', '));

    const storeRes = await client.query(`
      SELECT id, name, owner_name, phone, email, address
      FROM public.store_settings
      WHERE id = 1;
    `);
    if (storeRes.rows.length > 0) {
      console.log('\n🏪 Store Settings (id=1):');
      console.log(JSON.stringify(storeRes.rows[0], null, 2));
    }

    console.log('\n✅ Database schema and CHERAS CLOTHING brand are fully synchronized!');
  } catch (err) {
    console.error('\n❌ Migration failed during sequential execution:');
    console.error(err.message);
    if (err.position) {
      console.error(`Position: ${err.position}`);
    }
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

async function verifyDatabase(supabase) {
  console.log('\n🔍 Verifying database via Supabase client...');
  const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
  if (error) {
    console.log('Verification check notice:', error.message);
  } else if (data) {
    console.log('✅ store_settings record:', JSON.stringify(data, null, 2));
  }
}

main().catch((err) => {
  console.error('Fatal error running migrations:', err);
  process.exit(1);
});
