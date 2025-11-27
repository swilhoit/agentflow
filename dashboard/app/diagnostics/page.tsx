'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Database,
  TrendingUp,
  Wallet,
  Settings,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Bot,
  DollarSign,
  LineChart,
  LayoutDashboard
} from 'lucide-react';

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
  icon: React.ElementType;
  checks: DiagnosticCheck[];
}

const StatusIcon = ({ status }: { status: 'success' | 'warning' | 'error' }) => {
  if (status === 'success') return <CheckCircle className="w-5 h-5 text-success" />;
  if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-warning" />;
  return <XCircle className="w-5 h-5 text-destructive" />;
};

function DiagnosticsPageSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-20 w-24" />
            </div>
            <Skeleton className="h-3 w-full mt-6" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-20 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runDiagnostics();
  }, []);

  async function runDiagnostics() {
    setLoading(true);
    const sections: DiagnosticSection[] = [];

    // Database Diagnostics (Cloud)
    const dbChecks: DiagnosticCheck[] = [];
    try {
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
      icon: Database,
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
      icon: TrendingUp,
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
      icon: Wallet,
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
      icon: Settings,
      checks: systemChecks
    });

    setDiagnostics(sections);
    setLoading(false);
  }

  if (loading) {
    return <DiagnosticsPageSkeleton />;
  }

  const allChecks = diagnostics.flatMap(s => s.checks);
  const successCount = allChecks.filter(c => c.status === 'success').length;
  const warningCount = allChecks.filter(c => c.status === 'warning').length;
  const errorCount = allChecks.filter(c => c.status === 'error').length;
  const totalChecks = allChecks.length;
  const healthScore = totalChecks > 0 ? Math.round((successCount / totalChecks) * 100) : 0;

  const quickLinks = [
    { href: '/agents', icon: Bot, label: 'Agent Manager' },
    { href: '/finances', icon: DollarSign, label: 'Finances' },
    { href: '/investments', icon: LineChart, label: 'Investments' },
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="w-3 h-3" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-semibold text-foreground">System Diagnostics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cloud database health and data verification
            </p>
          </div>
          <button
            onClick={runDiagnostics}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Overall Health Score */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-2">Overall System Health</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-success" />
                    {successCount} successful
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    {warningCount} warnings
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-destructive" />
                    {errorCount} errors
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className={cn(
                  "text-5xl font-bold tabular-nums",
                  healthScore >= 90 ? 'text-success' :
                  healthScore >= 70 ? 'text-warning' :
                  'text-destructive'
                )}>
                  {healthScore}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {totalChecks} checks completed
                </div>
              </div>
            </div>

            <div className="mt-6 w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  healthScore >= 90 ? 'bg-success' :
                  healthScore >= 70 ? 'bg-warning' :
                  'bg-destructive'
                )}
                style={{ width: `${healthScore}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Diagnostic Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {diagnostics.map((section, idx) => {
            const Icon = section.icon;
            return (
              <Card key={idx}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {section.checks.map((check, checkIdx) => (
                      <div
                        key={checkIdx}
                        className={cn(
                          "p-4 rounded-lg border",
                          check.status === 'success' ? 'border-success/30 bg-success/5' :
                          check.status === 'warning' ? 'border-warning/30 bg-warning/5' :
                          'border-destructive/30 bg-destructive/5'
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{check.name}</div>
                            <div className={cn(
                              "text-sm mt-1",
                              check.status === 'success' ? 'text-success' :
                              check.status === 'warning' ? 'text-warning' :
                              'text-destructive'
                            )}>
                              {check.message}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {check.count !== undefined && (
                              <Badge variant="secondary" className="text-xs tabular-nums">
                                {check.count}
                              </Badge>
                            )}
                            <StatusIcon status={check.status} />
                          </div>
                        </div>
                        {check.details && (
                          <div className="text-xs text-muted-foreground mt-2">
                            {check.details}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickLinks.map((link) => {
                const LinkIcon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="p-4 rounded-lg border border-border hover:bg-muted transition-colors text-center group"
                  >
                    <LinkIcon className="w-6 h-6 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div className="text-sm font-medium">{link.label}</div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Last Updated */}
        <div className="text-center text-xs text-muted-foreground">
          Last checked: {new Date().toLocaleString()}
        </div>
      </div>
    </DashboardLayout>
  );
}
