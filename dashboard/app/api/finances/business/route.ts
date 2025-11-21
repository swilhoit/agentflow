import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

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
    id: number;
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
    1: { start: [0, 1], end: [2, 31] },    // Jan 1 - Mar 31
    2: { start: [3, 1], end: [5, 30] },    // Apr 1 - Jun 30
    3: { start: [6, 1], end: [8, 30] },    // Jul 1 - Sep 30
    4: { start: [9, 1], end: [11, 31] }    // Oct 1 - Dec 31
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
    new Date(year, 3, 15),  // April 15
    new Date(year, 5, 15),  // June 15
    new Date(year, 8, 15),  // September 15
    new Date(year + 1, 0, 15) // January 15 (next year)
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
    const db = getDatabase();
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
    const thisMonthResult = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM financial_transactions
      WHERE amount < 0
        AND is_business_expense = 1
        AND date >= ?
        AND date < ?
    `).get(thisMonthStart, nextMonthStart) as any;

    // This quarter business expenses
    const thisQuarterResult = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM financial_transactions
      WHERE amount < 0
        AND is_business_expense = 1
        AND date >= ?
        AND date <= ?
    `).get(quarterDates.start, quarterDates.end) as any;

    // YTD business expenses
    const ytdResult = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM financial_transactions
      WHERE amount < 0
        AND is_business_expense = 1
        AND date >= ?
    `).get(ytdStart) as any;

    // Tax deductible amount (all business expenses are deductible, but meals are 50%)
    const taxDeductibleResult = db.prepare(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN tax_category = 'Travel & Meals' THEN ABS(amount) * 0.5
            ELSE ABS(amount)
          END
        ), 0) as total
      FROM financial_transactions
      WHERE amount < 0
        AND is_business_expense = 1
        AND date >= ?
    `).get(ytdStart) as any;

    // Category breakdown (YTD)
    const categoryData = db.prepare(`
      SELECT
        COALESCE(tax_category, 'Uncategorized') as category,
        COALESCE(SUM(ABS(amount)), 0) as amount,
        COUNT(*) as count
      FROM financial_transactions
      WHERE amount < 0
        AND is_business_expense = 1
        AND date >= ?
      GROUP BY tax_category
      ORDER BY amount DESC
    `).all(ytdStart) as any[];

    const totalCategoryAmount = categoryData.reduce((sum, row) => sum + row.amount, 0);
    const categoryBreakdown = categoryData.map((row: any) => ({
      category: row.category,
      amount: row.amount,
      count: row.count,
      percentage: totalCategoryAmount > 0 ? (row.amount / totalCategoryAmount) * 100 : 0
    }));

    // Monthly trend (last 12 months)
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split('T')[0];

    const trendData = db.prepare(`
      SELECT
        strftime('%Y-%m', date) as month,
        COALESCE(SUM(ABS(amount)), 0) as amount
      FROM financial_transactions
      WHERE amount < 0
        AND is_business_expense = 1
        AND date >= ?
      GROUP BY month
      ORDER BY month ASC
    `).all(twelveMonthsAgoStr) as any[];

    // Business transactions (last 100)
    const transactions = db.prepare(`
      SELECT
        id, date, description, amount, category, tax_category, merchant, receipt_url
      FROM financial_transactions
      WHERE amount < 0
        AND is_business_expense = 1
      ORDER BY date DESC, id DESC
      LIMIT 100
    `).all() as any[];

    // Quarterly tax estimates
    const quarterlyEstimates = {
      q1: 0,
      q2: 0,
      q3: 0,
      q4: 0
    };

    for (let q = 1; q <= 4; q++) {
      const dates = getQuarterDates(currentYear, q);
      const result = db.prepare(`
        SELECT COALESCE(SUM(ABS(amount)), 0) as total
        FROM financial_transactions
        WHERE amount < 0
          AND is_business_expense = 1
          AND date >= ?
          AND date <= ?
      `).get(dates.start, dates.end) as any;

      quarterlyEstimates[`q${q}` as keyof typeof quarterlyEstimates] = result.total;
    }

    const summary: BusinessExpenseSummary = {
      thisMonth: thisMonthResult.total,
      thisQuarter: thisQuarterResult.total,
      ytd: ytdResult.total,
      taxDeductible: taxDeductibleResult.total,
      categoryBreakdown,
      monthlyTrend: trendData,
      transactions: transactions.map((t: any) => ({
        ...t,
        amount: Math.abs(t.amount) // Convert to positive for display
      })),
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
    const db = getDatabase();
    const body = await request.json();
    const { transactionId, taxCategory, isBusinessExpense, receiptUrl } = body;

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Update transaction
    db.prepare(`
      UPDATE financial_transactions
      SET
        is_business_expense = ?,
        tax_category = ?,
        receipt_url = ?
      WHERE id = ?
    `).run(
      isBusinessExpense ? 1 : 0,
      taxCategory || null,
      receiptUrl || null,
      transactionId
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
