/**
 * Database Migration Script for Dashboard Features
 *
 * Adds new tables and columns for:
 * - Loan tracking
 * - Business expense categorization
 * - Income targets
 */

import { getDatabase } from '../src/services/database';
import { logger } from '../src/utils/logger';

function runMigration() {
  logger.info('🔧 Starting database migration for dashboard features...');

  const db = getDatabase();
  const rawDb = db.getDb();

  try {
    // Start transaction
    rawDb.exec('BEGIN TRANSACTION');

    // ============================================================
    // 1. Create loans table
    // ============================================================
    logger.info('Creating loans table...');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        original_amount REAL NOT NULL,
        current_balance REAL NOT NULL,
        interest_rate REAL NOT NULL,
        monthly_payment REAL NOT NULL,
        start_date TEXT NOT NULL,
        payoff_date TEXT,
        loan_type TEXT CHECK(loan_type IN ('personal', 'student', 'auto', 'mortgage', 'credit', 'other')) DEFAULT 'personal',
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paid_off', 'deferred')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for loans
    rawDb.exec(`CREATE INDEX IF NOT EXISTS idx_loans_user
                 ON loans(user_id, status)`);
    rawDb.exec(`CREATE INDEX IF NOT EXISTS idx_loans_status
                 ON loans(status)`);

    logger.info('✅ Loans table created');

    // ============================================================
    // 2. Create loan_payments table
    // ============================================================
    logger.info('Creating loan_payments table...');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS loan_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        payment_amount REAL NOT NULL,
        principal REAL NOT NULL,
        interest REAL NOT NULL,
        remaining_balance REAL NOT NULL,
        transaction_id TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for loan_payments
    rawDb.exec(`CREATE INDEX IF NOT EXISTS idx_loan_payments_loan
                 ON loan_payments(loan_id, payment_date DESC)`);
    rawDb.exec(`CREATE INDEX IF NOT EXISTS idx_loan_payments_transaction
                 ON loan_payments(transaction_id)`);

    logger.info('✅ Loan payments table created');

    // ============================================================
    // 3. Create income_targets table
    // ============================================================
    logger.info('Creating income_targets table...');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS income_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        month TEXT NOT NULL,
        target_amount REAL NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, month)
      )
    `);

    // Create indexes for income_targets
    rawDb.exec(`CREATE INDEX IF NOT EXISTS idx_income_targets_user_month
                 ON income_targets(user_id, month DESC)`);

    logger.info('✅ Income targets table created');

    // ============================================================
    // 4. Add business expense columns to financial_transactions
    // ============================================================
    logger.info('Adding business expense columns to financial_transactions...');

    // Check if columns already exist
    const tableInfo = rawDb.prepare(`PRAGMA table_info(financial_transactions)`).all() as any[];
    const existingColumns = tableInfo.map(col => col.name);

    if (!existingColumns.includes('is_business_expense')) {
      rawDb.exec(`ALTER TABLE financial_transactions ADD COLUMN is_business_expense BOOLEAN DEFAULT 0`);
      logger.info('✅ Added is_business_expense column');
    } else {
      logger.info('⏭️  is_business_expense column already exists');
    }

    if (!existingColumns.includes('tax_category')) {
      rawDb.exec(`ALTER TABLE financial_transactions ADD COLUMN tax_category TEXT`);
      logger.info('✅ Added tax_category column');
    } else {
      logger.info('⏭️  tax_category column already exists');
    }

    if (!existingColumns.includes('receipt_url')) {
      rawDb.exec(`ALTER TABLE financial_transactions ADD COLUMN receipt_url TEXT`);
      logger.info('✅ Added receipt_url column');
    } else {
      logger.info('⏭️  receipt_url column already exists');
    }

    // Create indexes for business expenses
    rawDb.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_business
                 ON financial_transactions(is_business_expense, date DESC)`);
    rawDb.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_tax_category
                 ON financial_transactions(tax_category, date DESC)`);

    // ============================================================
    // 5. Create transaction_rules table (for auto-categorization)
    // ============================================================
    logger.info('Creating transaction_rules table...');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS transaction_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        rule_name TEXT NOT NULL,
        match_field TEXT NOT NULL CHECK(match_field IN ('description', 'merchant', 'amount')),
        match_pattern TEXT NOT NULL,
        action_type TEXT NOT NULL CHECK(action_type IN ('set_category', 'set_business', 'set_tax_category')),
        action_value TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        priority INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for transaction_rules
    rawDb.exec(`CREATE INDEX IF NOT EXISTS idx_transaction_rules_user
                 ON transaction_rules(user_id, is_active, priority DESC)`);

    logger.info('✅ Transaction rules table created');

    // ============================================================
    // 6. Create budget_alerts table
    // ============================================================
    logger.info('Creating budget_alerts table...');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS budget_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        alert_type TEXT NOT NULL CHECK(alert_type IN ('budget_exceeded', 'loan_payment_due', 'income_target_missed', 'unusual_spending')),
        category TEXT,
        threshold_amount REAL,
        current_amount REAL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        notified_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for budget_alerts
    rawDb.exec(`CREATE INDEX IF NOT EXISTS idx_budget_alerts_user
                 ON budget_alerts(user_id, is_read, created_at DESC)`);

    logger.info('✅ Budget alerts table created');

    // Commit transaction
    rawDb.exec('COMMIT');

    logger.info('');
    logger.info('✅ ✅ ✅ Migration completed successfully! ✅ ✅ ✅');
    logger.info('');
    logger.info('New tables created:');
    logger.info('  - loans');
    logger.info('  - loan_payments');
    logger.info('  - income_targets');
    logger.info('  - transaction_rules');
    logger.info('  - budget_alerts');
    logger.info('');
    logger.info('New columns added to financial_transactions:');
    logger.info('  - is_business_expense');
    logger.info('  - tax_category');
    logger.info('  - receipt_url');
    logger.info('');

  } catch (error) {
    // Rollback on error
    rawDb.exec('ROLLBACK');
    logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run migration
runMigration();
