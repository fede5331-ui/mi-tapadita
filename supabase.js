const SUPABASE_URL = 'https://hscvjeyepeogpaqtutni.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bPdXXh9QywZH53mSH55MRA_6NDU-WkZ';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);