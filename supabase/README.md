# CHERAS CLOTHING Supabase Setup

Apply the migrations in filename order to your dedicated Supabase project.

### Quick Options to Apply Migrations:

1. **Option 1 (Automated Node Script):**
   ```bash
   npm run migrate:db <your_db_password>
   ```

2. **Option 2 (Supabase Dashboard SQL Editor):**
   - Open your project SQL editor: `https://supabase.com/dashboard/project/<your-project-ref>/sql`
   - Paste and run `supabase/all_migrations_consolidated.sql`

3. **Synchronize Brand Information:**
   ```bash
   npm run sync:brand
   ```
