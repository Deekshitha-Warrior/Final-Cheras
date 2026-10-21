/**
 * Automated Universal Look Brand Synchronization Script
 *
 * Inspects and updates existing store settings, categories, and branding records in Supabase.
 */

const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in environment.');
  console.error('Ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const TARGET_SETTINGS = {
  id: 1,
  name: 'CHERAS CLOTHING',
  owner_name: '',
  phone: '9715083947',
  email: 'cherasclothing777@gmail.com',
  address: '74, Cheras Clothing, Avinashi Road, opposite to Government Medical College, Coimbatore 641014',
  updated_at: new Date().toISOString(),
};

async function syncBrand() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏪 CHERAS CLOTHING - SUPABASE BRAND SYNCHRONIZATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Connecting to: ${SUPABASE_URL}\n`);

  // 1. Check if store_settings table exists
  console.log('[1/4] Checking store_settings table...');
  const { data: existingSettings, error: fetchErr } = await supabase
    .from('store_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (fetchErr) {
    if (fetchErr.code === 'PGRST205' || fetchErr.message?.includes('schema cache')) {
      console.log('⚠️  Table "public.store_settings" does not exist yet in Supabase.');
      console.log('    Please apply database migrations first:');
      console.log('    • Option A: node scripts/run-migrations.cjs <db_password>');
      console.log('    • Option B: Run supabase/all_migrations_consolidated.sql in Supabase SQL Editor.');
      console.log('    Then re-run npm run sync:brand.\n');
      return;
    }
    console.error('❌ Error fetching store_settings:', fetchErr.message);
    process.exit(1);
  }

  // 2. Upsert store_settings (id = 1)
  console.log('[2/4] Synchronizing store_settings record (id: 1)...');
  const { data: upsertedSettings, error: upsertErr } = await supabase
    .from('store_settings')
    .upsert(TARGET_SETTINGS, { onConflict: 'id' })
    .select()
    .single();

  if (upsertErr) {
    console.error('❌ Failed to update store_settings:', upsertErr.message);
  } else {
    console.log('✅ store_settings updated successfully:');
    console.log(`   • Name       : ${upsertedSettings.name}`);
    console.log(`   • Owner      : ${upsertedSettings.owner_name || '(blank)'}`);
    console.log(`   • Phone      : ${upsertedSettings.phone}`);
    console.log(`   • Email      : ${upsertedSettings.email}`);
    console.log(`   • Address    : ${upsertedSettings.address}`);
    console.log(`   • Instagram  : @cherasclothing_official (https://www.instagram.com/cherasclothing_official/) - stored in src/lib/brand.ts (no DB column)`);
    console.log(`   • Updated At : ${upsertedSettings.updated_at}\n`);
  }

  // 3. Inspect categories and clean legacy boutique references if any
  console.log('[3/4] Inspecting product categories...');
  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('*');

  if (catErr) {
    console.log(`   (Note: categories table check returned: ${catErr.message})`);
  } else if (categories && categories.length > 0) {
    console.log(`   Found ${categories.length} existing categories.`);
    // Check if any legacy category name exists
    const legacyCategories = categories.filter(c =>
      /purple\s*boutique|sreeja|chaji/i.test(c.name || '')
    );
    if (legacyCategories.length > 0) {
      console.log(`   Found ${legacyCategories.length} legacy category references to update.`);
      for (const leg of legacyCategories) {
        let cleanName = leg.name
          .replace(/purple\s*boutique/gi, 'CHERAS CLOTHING')
          .replace(/chaji\s*mens\s*wear/gi, 'CHERAS CLOTHING')
          .replace(/chaji/gi, 'CHERAS CLOTHING')
          .replace(/universal\s*look/gi, 'CHERAS CLOTHING');
        await supabase
          .from('categories')
          .update({ name: cleanName })
          .eq('id', leg.id);
        console.log(`   • Renamed category: "${leg.name}" -> "${cleanName}"`);
      }
    } else {
      console.log('   ✅ All category names are clean.');
    }
  } else {
    console.log('   Category table is currently empty.');
  }

  // 4. Verify Final State
  console.log('\n[4/4] Verifying synchronized database state...');
  const { data: verified, error: verifyErr } = await supabase
    .from('store_settings')
    .select('id, name, owner_name, phone, email, address, updated_at')
    .eq('id', 1)
    .single();

  if (verifyErr) {
    console.error('❌ Verification failed:', verifyErr.message);
  } else {
    console.log('✅ Final Verified Database State:');
    console.log(JSON.stringify(verified, null, 2));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 BRAND SYNCHRONIZATION FINISHED!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

syncBrand().catch(err => {
  console.error('Unexpected error in syncBrand:', err);
  process.exit(1);
});
