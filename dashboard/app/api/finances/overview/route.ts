import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

/**
 * Financial Overview API
 *
 * Data Conventions (from Teller API):
 * - Checking accounts: positive = deposits/income, negative = payments/expenses
 * - Credit cards: positive = purchases (card_payment), negative = payments/refunds
 *
 * To calculate correct totals:
 * - Income: checking account positive transactions (excluding transfers from other accounts)
 * - Expenses: checking account negative (excluding CC payments) + credit card purchases (positive amounts)
 * - Transfers: CC payments from checking, CC refund entries (double-entry)
 */

interface FinancialOverview {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number;
    businessExpenses: number;
    loanPayments: number;
  };
  accounts: Array<{
    name: string;
    type: string;
    balance: number;
    institution: string;
  }>;
  monthlyTrend: Array<{
    month: string;
    income: number;
    expenses: number;
    net: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  upcomingPayments: Array<{
    type: 'loan' | 'bill' | 'tax';
    name: string;
    amount: number;
    dueDate: string;
  }>;
  recentTransactions: Array<{
    date: string;
    description: string;
    amount: number;
    category: string | null;
    merchant: string | null;
    accountName: string | null;
  }>;
}

export async function GET(request: Request) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const nextMonthStart = `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, '0')}-01`;

    // INCOME: Checking account positive amounts, excluding internal transfers
    // Internal transfers pattern: "ONLINE FROM" (from savings), account verification micro-deposits
    const incomeResult = await query(
      `SELECT amount, description FROM financial_transactions
       WHERE amount > 0
       AND date >= $1 AND date < $2
       AND type = 'transaction'
       AND account_type = 'depository'
       AND description NOT ILIKE '%ACCTVERIFY%'`,
      [thisMonthStart, nextMonthStart]
    );
    const totalIncome = (incomeResult.rows || []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

    // EXPENSES: Two sources
    // 1. Credit card purchases (type='card_payment', stored as positive, ARE expenses)
    // 2. Checking account debits EXCLUDING credit card payments (type='transaction', negative)

    // Credit card purchases (stored positive, are actual spending)
    const ccExpenseResult = await query(
      `SELECT amount, description FROM financial_transactions
       WHERE type = 'card_payment'
       AND date >= $1 AND date < $2`,
      [thisMonthStart, nextMonthStart]
    );
    const ccExpenses = (ccExpenseResult.rows || []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

    // Checking account expenses (stored negative) - EXCLUDE credit card payments
    // CC payment patterns: "ACH PMT AMEX", "WEB PMTS", "PAYMENT VENMO" etc
    const checkingExpenseResult = await query(
      `SELECT amount, description FROM financial_transactions
       WHERE amount < 0
       AND date >= $1 AND date < $2
       AND type = 'transaction'
       AND account_type = 'depository'
       AND description NOT ILIKE '%ACH PMT AMEX%'
       AND description NOT ILIKE '%WEB PMTS%'`,
      [thisMonthStart, nextMonthStart]
    );
    const checkingExpenses = (checkingExpenseResult.rows || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);

    const totalExpenses = ccExpenses + checkingExpenses;

    // Business expenses - estimate from credit card transactions with business-like merchants
    // (Claude AI, domain registrars, cloud services, etc.)
    const businessPatterns = ['CLAUDE.AI', 'MIDJOURNEY', 'OPENAI', 'ANTHROPIC', 'VERCEL', 'GITHUB', 'AWS', 'GOOGLE CLOUD', 'DIGITALOCEAN', 'HETZNER', 'NAMECHEAP', 'GODADDY', 'ZOOM', 'SLACK', 'FIGMA', 'NOTION'];
    const businessConditions = businessPatterns.map((_, i) => `description ILIKE $${i + 3}`).join(' OR ');
    const businessResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE type = 'card_payment'
       AND date >= $1 AND date < $2
       AND (${businessConditions})`,
      [thisMonthStart, nextMonthStart, ...businessPatterns.map(p => `%${p}%`)]
    );
    const businessExpenses = (businessResult.rows || []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

    // Get loan payments from loans table
    let loanPayments = 0;
    try {
      const loansResult = await query(
        `SELECT monthly_payment FROM loans WHERE status = 'active'`
      );
      loanPayments = (loansResult.rows || []).reduce((sum: number, loan: any) => sum + Number(loan.monthly_payment || 0), 0);
    } catch {
      // Loans table might not have data
    }

    // Account balances - calculate net position for each account
    // For credit cards: sum of card_payments (owed) minus refunds (paid)
    // For checking: sum of all transactions
    const accountsResult = await query(
      `SELECT
        account_name as name,
        account_type as type,
        institution,
        account_id,
        SUM(CASE
          WHEN account_type = 'credit' THEN -amount  -- Flip sign for credit cards
          ELSE amount
        END) as balance
       FROM financial_transactions
       WHERE account_name IS NOT NULL
       GROUP BY account_name, account_type, institution, account_id
       ORDER BY account_name`
    );
    const accounts = (accountsResult.rows || []).map((acc: any) => ({
      name: acc.name || 'Unknown',
      type: acc.type || 'unknown',
      balance: Number(acc.balance) || 0,
      institution: acc.institution || 'Unknown'
    }));

    // Monthly trend - last 6 months with CORRECT income/expense calculation
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const monthlyResult = await query(
      `SELECT date, amount, type, account_type, description FROM financial_transactions
       WHERE date >= $1
       ORDER BY date`,
      [sixMonthsAgoStr]
    );

    // Group by month with correct calculation
    const monthlyMap = new Map<string, { income: number; expenses: number }>();
    (monthlyResult.rows || []).forEach((tx: any) => {
      const dateStr = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date);
      const month = dateStr.substring(0, 7);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { income: 0, expenses: 0 });
      }
      const entry = monthlyMap.get(month)!;
      const amount = Number(tx.amount);
      const desc = (tx.description || '').toUpperCase();

      // Skip transfers/payments between accounts
      if (tx.type === 'refund' ||
          desc.includes('ACH PMT AMEX') ||
          desc.includes('WEB PMTS') ||
          desc.includes('ACCTVERIFY')) {
        return;
      }

      if (tx.type === 'card_payment') {
        // Credit card purchases are expenses
        entry.expenses += amount;
      } else if (tx.account_type === 'depository') {
        if (amount > 0) {
          entry.income += amount;
        } else {
          entry.expenses += Math.abs(amount);
        }
      }
    });

    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
        net: Math.round((data.income - data.expenses) * 100) / 100
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Category breakdown - based on merchant/description patterns since category is often null
    // Group expenses by detected category
    const allExpensesResult = await query(
      `SELECT description, amount, type, account_type FROM financial_transactions
       WHERE date >= $1 AND date < $2
       AND ((type = 'card_payment') OR (type = 'transaction' AND amount < 0 AND account_type = 'depository'))
       AND description NOT ILIKE '%ACH PMT AMEX%'
       AND description NOT ILIKE '%WEB PMTS%'`,
      [thisMonthStart, nextMonthStart]
    );

    const categoryMap = new Map<string, number>();
    (allExpensesResult.rows || []).forEach((tx: any) => {
      const desc = (tx.description || '').toUpperCase();
      const amount = tx.type === 'card_payment' ? Number(tx.amount) : Math.abs(Number(tx.amount));

      // Categorize by merchant patterns
      let category = 'Other';
      if (desc.includes('WHOLEFDS') || desc.includes('WHOLE FOODS') || desc.includes('TRADER JOE') || desc.includes('GROCERY') || desc.includes('SAFEWAY') || desc.includes('KROGER')) {
        category = 'Groceries';
      } else if (desc.includes('UBER EATS') || desc.includes('DOORDASH') || desc.includes('GRUBHUB') || desc.includes('POSTMATES') || desc.includes('RESTAURANT') || desc.includes('CAFE') || desc.includes('COFFEE') || desc.includes('BAR ') || desc.includes('LOUNGE') || desc.includes('FOGO') || desc.includes('ROKA AKOR')) {
        category = 'Dining';
      } else if (desc.includes('AMAZON') || desc.includes('APPLE') || desc.includes('TARGET') || desc.includes('WALMART')) {
        category = 'Shopping';
      } else if (desc.includes('HILTON') || desc.includes('MARRIOTT') || desc.includes('HOTEL') || desc.includes('AIRBNB') || desc.includes('UNITED') || desc.includes('DELTA') || desc.includes('SOUTHWEST') || desc.includes('AIRLINE')) {
        category = 'Travel';
      } else if (desc.includes('CLAUDE') || desc.includes('MIDJOURNEY') || desc.includes('OPENAI') || desc.includes('GITHUB') || desc.includes('VERCEL') || desc.includes('NOTION') || desc.includes('ZOOM') || desc.includes('FIGMA')) {
        category = 'Software/Tech';
      } else if (desc.includes('AT&T') || desc.includes('VERIZON') || desc.includes('T-MOBILE') || desc.includes('COMCAST') || desc.includes('SPECTRUM')) {
        category = 'Utilities';
      } else if (desc.includes('GAS') || desc.includes('SHELL') || desc.includes('CHEVRON') || desc.includes('EXXON') || desc.includes('BP ')) {
        category = 'Gas';
      } else if (desc.includes('VENMO') || desc.includes('PAYPAL') || desc.includes('ZELLE') || desc.includes('CASH APP')) {
        category = 'Transfers/P2P';
      }

      categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
    });

    const totalCategoryAmount = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0);
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        percentage: totalCategoryAmount > 0 ? Math.round((amount / totalCategoryAmount) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    // Upcoming payments from loans table
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0].substring(0, 7);

    let upcomingPayments: Array<{ type: 'loan' | 'bill' | 'tax'; name: string; amount: number; dueDate: string }> = [];
    try {
      const loansResult = await query(
        `SELECT name, monthly_payment FROM loans WHERE status = 'active' ORDER BY monthly_payment DESC LIMIT 5`
      );
      upcomingPayments = (loansResult.rows || []).map((loan: any) => ({
        type: 'loan' as const,
        name: loan.name,
        amount: Number(loan.monthly_payment),
        dueDate: `${nextMonthStr}-01`
      }));
    } catch {
      // Loans table might not have data
    }

    // Recent transactions (excluding internal transfers)
    const recentResult = await query(
      `SELECT date, description, amount, category, merchant, account_name, type
       FROM financial_transactions
       WHERE type != 'refund'
       AND description NOT ILIKE '%ACH PMT AMEX%'
       AND description NOT ILIKE '%WEB PMTS%'
       AND description NOT ILIKE '%ACCTVERIFY%'
       ORDER BY date DESC LIMIT 15`
    );

    const recentTransactions = (recentResult.rows || []).map((tx: any) => ({
      date: tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date),
      description: tx.description || '',
      // Flip sign for credit card purchases to show as negative (expense)
      amount: tx.type === 'card_payment' ? -Number(tx.amount) : Number(tx.amount),
      category: tx.category,
      merchant: tx.merchant,
      accountName: tx.account_name
    }));

    // Calculate summary
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    const overview: FinancialOverview = {
      summary: {
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netSavings: Math.round(netSavings * 100) / 100,
        savingsRate: Math.round(savingsRate * 10) / 10,
        businessExpenses: Math.round(businessExpenses * 100) / 100,
        loanPayments
      },
      accounts,
      monthlyTrend,
      categoryBreakdown,
      upcomingPayments,
      recentTransactions
    };

    return NextResponse.json(overview);
  } catch (error: any) {
    console.error('Error fetching financial overview:', error);
    return NextResponse.json({ error: 'Failed to fetch financial overview', details: error.message }, { status: 500 });
  }
}
