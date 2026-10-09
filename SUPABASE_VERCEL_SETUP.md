# Supabase + Next.js + Vercel Integration Guide

InvoiceReady is configured for **Next.js (App Router)** + **Tailwind CSS** with **Supabase** (Database, Auth, Storage) and hosted on **Vercel**.

---

## 1. Apply Database Schema & Row Level Security (RLS)

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project and click **SQL Editor** in the left sidebar.
3. Click **New query**, open the `supabase/schema.sql` file from this repository, copy its entire contents, and paste it into the editor.
4. Click **Run**.
5. This creates:
   - `organizations` & `organization_users` (multi-tenant scoping)
   - `profiles` (automatically synchronized with Supabase Auth users via trigger)
   - `business_profiles` & `system_profiles`
   - `scan_sessions`, `findings`, and `remediations`
   - `audit_logs`
   - `invoices` & `reports` Supabase Storage buckets with strict RLS policies

---

## 2. Supabase Authentication Setup

1. In Supabase Dashboard, go to **Authentication** -> **Providers**.
2. **Email / Password**:
   - Enabled by default.
   - (Optional) Toggle "Confirm email" off if you want immediate signup without email verification during testing.
3. **Google Sign-In (Optional)**:
   - Enable Google provider, provide Client ID and Secret from Google Cloud Console, and copy the Authorized Redirect URI to your Google OAuth client.

---

## 3. Storage Buckets Verification

The `supabase/schema.sql` automatically registers the two storage buckets:
- `invoices`: Stores uploaded invoices for deterministic security scanning and extraction.
- `reports`: Stores generated compliance audit reports and certificates.

If needed, you can verify these under **Storage** in the Supabase Dashboard.

---

## 4. Vercel Deployment

Since your GitHub repository is connected to Vercel and Supabase:
1. Vercel automatically detects Next.js and builds using `next build`.
2. Vercel's Supabase Integration automatically populates:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Optional: Add `GEMINI_API_KEY` in Vercel **Project Settings -> Environment Variables** to enable LLM extraction for non-standard formats.
4. Every push to your `main` branch on GitHub triggers an automatic production deployment.
