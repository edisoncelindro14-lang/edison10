-- Fix transactions type constraint to include all types used by the app
-- Run this in Supabase Dashboard → SQL Editor → New query → Paste → Run

-- Drop the old constraint that only allowed ('level_bonus','referral_bonus','withdrawal','adjustment')
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add new constraint with all types the app uses
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
  CHECK (type IN ('level_bonus','referral_bonus','withdrawal','adjustment','topup','purchase','refund'));
