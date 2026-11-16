import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://chthfkbrkcwgcsijwjix.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ba6WkpXJ6aHNNwrvjJqDHw_h1F6bQB6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const IMAGE_BUCKET = 'produtos';
