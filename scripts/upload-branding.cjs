const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function uploadLogos() {
  console.log('Connecting to Supabase Storage at:', url);

  // 1. List all buckets
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.error('List buckets error:', bErr);
    return;
  }
  console.log('Existing buckets:', buckets.map(b => b.name));

  // Ensure 'branding' bucket exists and is public
  let brandingBucket = buckets.find(b => b.name === 'branding');
  if (!brandingBucket) {
    console.log('Creating branding bucket...');
    const { data: cb, error: cbErr } = await supabase.storage.createBucket('branding', { public: true });
    if (cbErr) console.error('Error creating branding bucket:', cbErr);
    else console.log('Created branding bucket:', cb);
  } else if (!brandingBucket.public) {
    console.log('Updating branding bucket to public...');
    await supabase.storage.updateBucket('branding', { public: true });
  }

  // 2. Upload logo files from public/ to branding bucket
  const filesToUpload = [
    { local: 'cheras-logo.png', mime: 'image/png' },
    { local: 'cheras-logo-white.png', mime: 'image/png' },
    { local: 'cheras-icon.png', mime: 'image/png' },
    { local: 'cheras-icon-white.png', mime: 'image/png' },
    { local: 'cheras-icon-512.png', mime: 'image/png' },
    { local: 'cheras-icon-192.png', mime: 'image/png' },
    { local: 'cheras-icon-maskable-512.png', mime: 'image/png' },
    { local: 'cheras-icon-maskable-192.png', mime: 'image/png' },
    { local: 'cheras-favicon.png', mime: 'image/png' },
    { local: 'favicon.png', mime: 'image/png' },
    { local: 'apple-touch-icon.png', mime: 'image/png' }
  ];

  console.log('\nUploading logos to "branding" bucket...');
  for (const item of filesToUpload) {
    const filePath = path.join(__dirname, '..', 'public', item.local);
    if (!fs.existsSync(filePath)) {
      console.warn('File not found:', filePath);
      continue;
    }
    const fileBuffer = fs.readFileSync(filePath);

    const { data, error } = await supabase.storage.from('branding').upload(item.local, fileBuffer, {
      contentType: item.mime,
      upsert: true
    });
    if (error) {
      console.error('Failed to upload ' + item.local + ':', error.message);
    } else {
      const { data: pUrl } = supabase.storage.from('branding').getPublicUrl(item.local);
      console.log('Uploaded: ' + item.local + ' -> ' + pUrl.publicUrl);
    }
  }

  // Also upload standard aliases 'logo.png' and 'icon.png'
  console.log('\nUploading aliases (logo.png, icon.png)...');
  await supabase.storage.from('branding').upload('logo.png', fs.readFileSync(path.join(__dirname, '..', 'public', 'cheras-logo.png')), {
    contentType: 'image/png',
    upsert: true
  });
  await supabase.storage.from('branding').upload('icon.png', fs.readFileSync(path.join(__dirname, '..', 'public', 'cheras-icon.png')), {
    contentType: 'image/png',
    upsert: true
  });

  // Verify contents of branding bucket
  const { data: uploadedList, error: lErr } = await supabase.storage.from('branding').list();
  if (lErr) {
    console.error('Error listing files in branding bucket:', lErr);
  } else {
    console.log('\nFiles currently in "branding" bucket:');
    for (const f of uploadedList) {
      console.log(' - ' + f.name + ' (' + (f.metadata?.size || 'unknown') + ' bytes)');
    }
  }
}

uploadLogos().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
