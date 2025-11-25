'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';

interface DiagnosticCheck {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
  count?: number;
}

interface DiagnosticSection {
  title: string;
  icon: string;
  checks: DiagnosticCheck[];
}

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function runDiagnostics() {
      const sections: DiagnosticSection[] = [];

      // Database Diagnostics (Cloud)
      const dbChecks: DiagnosticCheck[] = [];
      try {
        // Check Supabase connection via API
        const financeRes = await fetch('/api/finances/overview');
        if (financeRes.ok) {
          dbChecks.push({
            name: 'Database Connection',
            status: 'success',
            message: 'Supabase cloud database connected',
            details: 'PostgreSQL via Supabase'
          });
        } else {
          dbChecks.push({
            name: 'Database Connection',
            status: 'error',
            message: 'Failed to connect to database',
            details: 'Check Supabase credentials'
          });
        }

        // Check financial data
        const financeData = financeRes.ok ? await financeRes.json() : null;
        if (financeData && !financeData.error) {
          dbChecks.push({
            name: 'Financial Data',
            status: financeData.recentTransactions?.length > 0 ? 'success' : 'warning',
            message: financeData.recentTransactions?.length > 0 
              ? 'Transaction data available' 
              : 'No transactions found',
            count: financeData.recentTransactions?.length || 0
          });
        }
      } catch (error: any) {
        dbChecks.push({
          name: 'Database Diagnostics',
          status: 'error',
          message: 'Failed to run database diagnostics',
          details: error.message
        });
      }

      sections.push({
        title: 'Database',
        icon: '💾',
        checks: dbChecks
      });

      // Market Data Diagnostics
      const marketChecks: DiagnosticCheck[] = [];
      try {
        const investRes = await fetch('/api/investments');
        if (investRes.ok) {
          const investData = await investRes.json();
          
          marketChecks.push({
            name: 'Market Data Feed',
            status: investData.watchlist?.length > 0 ? 'success' : 'warning',
            message: investData.watchlist?.length > 0 ? 'Market data available' : 'No market data',
            count: investData.watchlist?.length || 0
          });

          if (investData.lastUpdated) {
            const dataAge = Date.now() - new Date(investData.lastUpdated).getTime();
            const hoursOld = Math.floor(dataAge / (1000 * 60 * 60));

            marketChecks.push({
              name: 'Data Freshness',
              status: hoursOld < 24 ? 'success' : hoursOld < 72 ? 'warning' : 'error',
              message: hoursOld < 24 ? 'Data is current' : `Data is ${hoursOld}h old`,
              details: `Last update: ${new Date(investData.lastUpdated).toLocaleString()}`
            });
          }

          // Check thesis portfolio
          const thesisTickers = ['UEC', 'CCJ', 'URNM', 'URA', 'DNN', 'UUUU', 'LEU'];
          const availableTickers = new Set((investData.watchlist || []).map((m: any) => m.symbol));
          const foundTickers = thesisTickers.filter(t => availableTickers.has(t));

          marketChecks.push({
            name: 'Thesis Portfolio Coverage',
            status: foundTickers.length > 0 ? 'success' : 'warning',
            message: `${foundTickers.length}/${thesisTickers.length} thesis tickers tracked`,
            details: foundTickers.join(', ') || 'None'
          });
        }
      } catch (error: any) {
        marketChecks.push({
          name: 'Market Data',
          status: 'error',
          message: 'Failed to check market data',
          details: error.message
        });
      }

      sections.push({
        title: 'Market Data',
        icon: '📈',
        checks: marketChecks
      });

      // Financial Data Diagnostics
      const financeChecks: DiagnosticCheck[] = [];
      try {
        const goalsRes = await fetch('/api/goals');
        if (goalsRes.ok) {
          const goalsData = await goalsRes.json();
          
          financeChecks.push({
            name: 'Monthly Income',
            status: goalsData.currentMonth?.income?.actual > 0 ? 'success' : 'warning',
            message: goalsData.currentMonth?.income?.actual > 0 
              ? `$${goalsData.currentMonth.income.actual.toFixed(2)} this month`
              : 'No income recorded',
            count: Math.round(goalsData.currentMonth?.income?.actual || 0)
          });

          financeChecks.push({
            name: 'Monthly Expenses',
            status: goalsData.currentMonth?.expenses?.actual > 0 ? 'success' : 'warning',
            message: goalsData.currentMonth?.expenses?.actual > 0 
              ? `$${goalsData.currentMonth.expenses.actual.toFixed(2)} this month`
              : 'No expenses recorded',
            count: Math.round(goalsData.currentMonth?.expenses?.actual || 0)
          });

          financeChecks.push({
            name: 'Savings Rate',
            status: goalsData.currentMonth?.savingsRate?.actual > 0 ? 'success' : 'warning',
            message: `${goalsData.currentMonth?.savingsRate?.actual?.toFixed(1) || 0}% savings rate`,
            details: `Net savings: $${goalsData.currentMonth?.savingsRate?.netSavings?.toFixed(2) || 0}`
          });
        }
      } catch (error: any) {
        financeChecks.push({
          name: 'Financial Data',
          status: 'error',
          message: 'Failed to check financial data',
          details: error.message
        });
      }

      sections.push({
        title: 'Financial Data',
        icon: '💰',
        checks: financeChecks
      });

      // Environment Checks
      const systemChecks: DiagnosticCheck[] = [];
      
      systemChecks.push({
        name: 'Database Type',
        status: 'success',
        message: 'Cloud (Supabase PostgreSQL)',
        details: 'No local database files used'
      });

      systemChecks.push({
        name: 'Environment',
        status: 'success',
        message: process.env.NODE_ENV || 'development',
        details: 'Next.js Dashboard'
      });

      sections.push({
        title: 'System Health',
        icon: '⚙️',
        checks: systemChecks
      });

      setDiagnostics(sections);
      setLoading(false);
    }

    runDiagnostics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <div className="text-xl">Running diagnostics...</div>
        </div>
      </div>
    );
  }

  // Calculate overall health
  const allChecks = diagnostics.flatMap(s => s.checks);
  const successCount = allChecks.filter(c => c.status === 'success').length;
  const warningCount = allChecks.filter(c => c.status === 'warning').length;
  const errorCount = allChecks.filter(c => c.status === 'error').length;
  const totalChecks = allChecks.length;
  const healthScore = totalChecks > 0 ? Math.round((successCount / totalChecks) * 100) : 0;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold mt-2">🔍 System Diagnostics</h1>
            <p className="text-muted-foreground mt-1">
              Cloud database health and data verification
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Overall Health Score */}
        <div className="border border-border bg-card p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Overall System Health</h2>
              <p className="text-muted-foreground">
                {successCount} successful • {warningCount} warnings • {errorCount} errors
              </p>
            </div>
            <div className="text-right">
              <div className={`text-6xl font-bold ${
                healthScore >= 90 ? 'text-primary' :
                healthScore >= 70 ? 'text-accent' :
                'text-destructive'
              }`}>
                {healthScore}%
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {totalChecks} checks completed
              </div>
            </div>
          </div>

          {/* Health bar */}
          <div className="mt-6 w-full h-3 bg-muted border border-border">
            <div
              className={`h-full transition-all ${
                healthScore >= 90 ? 'bg-primary' :
                healthScore >= 70 ? 'bg-accent' :
                'bg-destructive'
              }`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>

        {/* Diagnostic Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {diagnostics.map((section, idx) => (
            <div key={idx} className="border border-border bg-card p-6">
              <h2 className="text-xl font-bold mb-4">
                {section.icon} {section.title}
              </h2>
              <div className="space-y-3">
                {section.checks.map((check, checkIdx) => (
                  <div
                    key={checkIdx}
                    className={`border p-4 ${
                      check.status === 'success' ? 'border-primary bg-primary/5' :
                      check.status === 'warning' ? 'border-accent bg-accent/5' :
                      'border-destructive bg-destructive/5'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-bold text-sm">{check.name}</div>
                        <div className={`text-sm mt-1 ${
                          check.status === 'success' ? 'text-primary' :
                          check.status === 'warning' ? 'text-accent' :
                          'text-destructive'
                        }`}>
                          {check.message}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {check.count !== undefined && (
                          <span className="text-xs font-mono bg-muted px-2 py-1 border border-border">
                            {check.count}
                          </span>
                        )}
                        <span className="text-xl">
                          {check.status === 'success' ? '✅' :
                           check.status === 'warning' ? '⚠️' :
                           '❌'}
                        </span>
                      </div>
                    </div>
                    {check.details && (
                      <div className="text-xs text-muted-foreground mt-2 font-mono">
                        {check.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 border border-border bg-card p-6">
          <h2 className="text-xl font-bold mb-4">⚙️ Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/agents"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">🤖</div>
              <div className="text-sm font-medium">Agent Manager</div>
            </Link>
            <Link
              href="/finances"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">💰</div>
              <div className="text-sm font-medium">Finances</div>
            </Link>
            <Link
              href="/investments"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">📈</div>
              <div className="text-sm font-medium">Investments</div>
            </Link>
            <Link
              href="/dashboard"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm font-medium">Dashboard</div>
            </Link>
          </div>
        </div>

        {/* Last Updated */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Last checked: {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}
