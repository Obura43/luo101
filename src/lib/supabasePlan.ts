export const supabasePlan = {
  auth: ['email', 'magic_link', 'google_later'],
  tables: [
    'profiles',
    'units',
    'lessons',
    'exercises',
    'phrases',
    'user_progress',
    'mistake_reviews',
  ],
  storageBuckets: ['phrase-audio', 'lesson-art', 'mascot-assets'],
};

export const envKeys = {
  url: 'EXPO_PUBLIC_SUPABASE_URL',
  anonKey: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
};
