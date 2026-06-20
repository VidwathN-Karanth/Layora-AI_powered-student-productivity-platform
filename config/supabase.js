const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn('==================================================');
  console.warn('⚠️ WARNING: Supabase credentials are not fully configured.');
  console.warn('   Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  console.warn('   Database operations will fail at runtime.');
  console.warn('==================================================');
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error.message);
  }
}

module.exports = supabase;

