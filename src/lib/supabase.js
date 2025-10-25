import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qinojuywharkofzugqbw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbm9qdXl3aGFya29menVncWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNTQ4MjYsImV4cCI6MjA3NTkzMDgyNn0.Zl5Rv-HrswblTFK-Rd1EiGke1_jUBM2tYJdLh8BuG4o'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

