-- ============================================
-- LOANS TABLE
-- ============================================
-- Stores loan/debt tracking data for users

CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default_user',
  name TEXT NOT NULL,
  original_amount NUMERIC(12,2) NOT NULL,
  current_balance NUMERIC(12,2) NOT NULL,
  interest_rate NUMERIC(6,4) DEFAULT 0,
  monthly_payment NUMERIC(10,2) NOT NULL,
  start_date DATE NOT NULL,
  payoff_date DATE,
  loan_type TEXT NOT NULL DEFAULT 'personal' CHECK (loan_type IN ('personal', 'student', 'auto', 'mortgage', 'credit', 'other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'deferred')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_user ON public.loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(user_id, status);

-- Loans table RLS - allowing public access for now (default_user pattern)
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write for default_user pattern
CREATE POLICY "Anyone can read loans" ON public.loans
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert loans" ON public.loans
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update loans" ON public.loans
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete loans" ON public.loans
  FOR DELETE USING (true);

-- Service role full access
CREATE POLICY "Service role can manage all loans" ON public.loans
  FOR ALL USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
