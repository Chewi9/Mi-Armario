import { createClient } from '@supabase/supabase-js'

// Sustituye esto por tu Project URL de Supabase
const supabaseUrl = 'https://zntlxabzrsehzscogsfx.supabase.co'

// Sustituye esto por tu clave 'anon' / 'public' de Supabase
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpudGx4YWJ6cnNlaHpzY29nc2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTA2MTcsImV4cCI6MjEwMzIyNjYxN30.dnw3NWx5CRZKFX8hLPML2WCQGZCLkEywf93k75rOZAE'

export const supabase = createClient(supabaseUrl, supabaseKey)