import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

// IRS Business Expense Categories
export const TAX_CATEGORIES = [
  'Advertising & Marketing',
  'Office Supplies',
  'Software & Subscriptions',
  'Travel & Meals',
  'Professional Services',
  'Equipment & Depreciation',
  'Home Office',
  'Other Business Expenses'
] as const;

export type TaxCategory = typeof TAX_CATEGORIES[number];

interface BusinessExpenseSummary {
  thisMonth: number;
  thisQuarter: number;
  ytd: number;
  taxDeductible: number;
  categoryBreakdown: Array<{
    category: TaxCategory | string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    amount: number;
  }>;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    category: string | null;
    tax_category: TaxCategory | string | null;
    merchant: string | null;
    receipt_url: string | null;
  }>;
  quarterlyTaxEstimate: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    current: number;
    nextDueDate: string;
  };
}

function getQuarterDates(year: number, quarter: number): { start: string; end: string } {
  const quarters: Record<number, { start: [number, number]; end: [number, number] }> = {
    1: { start: [0, 1], end: [2, 31] },
    2: { start: [3, 1], end: [5, 30] },
    3: { start: [6, 1], end: [8, 30] },
    4: { start: [9, 1], end: [11, 31] }
  };

  const q = quarters[quarter];
  const start = new Date(year, q.start[0], q.start[1]).toISOString().split('T')[0];
  const end = new Date(year, q.end[0], q.end[1]).toISOString().split('T')[0];
  return { start, end };
}

function getCurrentQuarter(): number {
  const month = new Date().getMonth();
  return Math.floor(month / 3) + 1;
}

function getNextTaxDueDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const dueDates = [
    new Date(year, 3, 15),
    new Date(year, 5, 15),
    new Date(year, 8, 15),
    new Date(year + 1, 0, 15)
  ];

  for (const date of dueDates) {
    if (now < date) {
      return date.toISOString().split('T')[0];
    }
  }

  return dueDates[0].toISOString().split('T')[0];
}

export async function GET(request: Request) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentQuarter = getCurrentQuarter();

    // Calculate date ranges
    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const nextMonthStart = `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, '0')}-01`;
    const ytdStart = `${currentYear}-01-01`;
    const quarterDates = getQuarterDates(currentYear, currentQuarter);

    // This month business expenses
    const thisMonthResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE amount < 0 AND category = 'Business' AND date >= $1 AND date < $2`,
      [thisMonthStart, nextMonthStart]
    );
    const thisMonth = (thisMonthResult.rows || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);

    // This quarter business expenses
    const thisQuarterResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE amount < 0 AND category = 'Business' AND date >= $1 AND date <= $2`,
      [quarterDates.start, quarterDates.end]
    );
    const thisQuarter = (thisQuarterResult.rows || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);

    // YTD business expenses
    const ytdResult = await query(
      `SELECT amount, category FROM financial_transactions
       WHERE amount < 0 AND category = 'Business' AND date >= $1`,
      [ytdStart]
    );
    const ytd = (ytdResult.rows || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);

    // Tax deductible
    const taxDeductible = ytd;

    // Category breakdown
    const categoryMap = new Map<string, { amount: number; count: number }>();
    (ytdResult.rows || []).forEach((tx: any) => {
      const cat = 'Other Business Expenses';
      const existing = categoryMap.get(cat) || { amount: 0, count: 0 };
      categoryMap.set(cat, {
        amount: existing.amount + Math.abs(Number(tx.amount)),
        count: existing.count + 1
      });
    });

    const totalCategoryAmount = Array.from(categoryMap.values()).reduce((sum, v) => sum + v.amount, 0);
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
      percentage: totalCategoryAmount > 0 ? (data.amount / totalCategoryAmount) * 100 : 0
    }));

    // Monthly trend (last 12 months)
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split('T')[0];

    const trendResult = await query(
      `SELECT date, amount FROM financial_transactions
       WHERE amount < 0 AND category = 'Business' AND date >= $1 ORDER BY date`,
      [twelveMonthsAgoStr]
    );

    const monthlyMap = new Map<string, number>();
    (trendResult.rows || []).forEach((tx: any) => {
      const dateStr = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date);
      const month = dateStr.substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + Math.abs(Number(tx.amount)));
    });

    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Business transactions (last 100)
    const transactionsResult = await query(
      `SELECT id, date, description, amount, category, merchant
       FROM financial_transactions
       WHERE amount < 0 AND category = 'Business'
       ORDER BY date DESC LIMIT 100`
    );

    const transactions = (transactionsResult.rows || []).map((t: any) => ({
      id: String(t.id),
      date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date),
      description: t.description || '',
      amount: Math.abs(Number(t.amount)),
      category: t.category,
      tax_category: null,
      merchant: t.merchant,
      receipt_url: null
    }));

    // Quarterly tax estimates
    const quarterlyEstimates = { q1: 0, q2: 0, q3: 0, q4: 0 };

    for (let q = 1; q <= 4; q++) {
      const dates = getQuarterDates(currentYear, q);
      const qResult = await query(
        `SELECT amount FROM financial_transactions
         WHERE amount < 0 AND category = 'Business' AND date >= $1 AND date <= $2`,
        [dates.start, dates.end]
      );
      quarterlyEstimates[`q${q}` as keyof typeof quarterlyEstimates] =
        (qResult.rows || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);
    }

    const summary: BusinessExpenseSummary = {
      thisMonth,
      thisQuarter,
      ytd,
      taxDeductible,
      categoryBreakdown,
      monthlyTrend,
      transactions,
      quarterlyTaxEstimate: {
        ...quarterlyEstimates,
        current: quarterlyEstimates[`q${currentQuarter}` as keyof typeof quarterlyEstimates],
        nextDueDate: getNextTaxDueDate()
      }
    };

    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('Error fetching business expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business expenses', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactionId, isBusinessExpense } = body;

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Update transaction category to 'Business' or remove it
    await query(
      `UPDATE financial_transactions SET category = $1 WHERE id = $2`,
      [isBusinessExpense ? 'Business' : null, transactionId]
    );

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error updating business expense:', error);
    return NextResponse.json(
      { error: 'Failed to update business expense', details: error.message },
      { status: 500 }
    );
  }
}
