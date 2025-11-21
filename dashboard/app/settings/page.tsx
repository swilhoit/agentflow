'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Settings as SettingsIcon, Target, DollarSign, Bell, User, Palette } from 'lucide-react';

export default function SettingsPage() {
  // Financial Goals
  const [monthlyIncome, setMonthlyIncome] = useState('15000');
  const [monthlyExpenses, setMonthlyExpenses] = useState('8000');
  const [savingsRate, setSavingsRate] = useState('40');

  // Category Budgets
  const [categoryBudgets, setCategoryBudgets] = useState({
    'Food & Dining': '800',
    'Transportation': '500',
    'Shopping': '400',
    'Entertainment': '300',
    'Utilities': '200',
    'Healthcare': '300',
    'Travel': '500'
  });

  // User Preferences
  const [currency, setCurrency] = useState('USD');
  const [notifications, setNotifications] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);

  const handleSaveSettings = () => {
    // TODO: Save to database or local storage
    alert('Settings saved successfully!');
  };

  const handleCategoryBudgetChange = (category: string, value: string) => {
    setCategoryBudgets(prev => ({
      ...prev,
      [category]: value
    }));
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-mono uppercase">⚙️ SETTINGS</h1>
          <p className="text-sm text-muted-foreground font-mono mt-2">
            Customize your dashboard preferences and financial goals
          </p>
        </div>

        {/* Financial Goals Section */}
        <div className="border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold font-mono uppercase">FINANCIAL GOALS</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">
                  Monthly Income Target
                </label>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-2">$</span>
                  <input
                    type="number"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="flex-1 border border-border bg-background p-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">
                  Monthly Expense Limit
                </label>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-2">$</span>
                  <input
                    type="number"
                    value={monthlyExpenses}
                    onChange={(e) => setMonthlyExpenses(e.target.value)}
                    className="flex-1 border border-border bg-background p-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">
                  Target Savings Rate
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={savingsRate}
                    onChange={(e) => setSavingsRate(e.target.value)}
                    className="flex-1 border border-border bg-background p-2 font-mono text-sm"
                  />
                  <span className="text-muted-foreground ml-2">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Budgets Section */}
        <div className="border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold font-mono uppercase">CATEGORY BUDGETS</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(categoryBudgets).map(([category, value]) => (
              <div key={category}>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">
                  {category}
                </label>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-2">$</span>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => handleCategoryBudgetChange(category, e.target.value)}
                    className="flex-1 border border-border bg-background p-2 font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications Section */}
        <div className="border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold font-mono uppercase">NOTIFICATIONS</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-sm font-bold">Enable Notifications</div>
                <div className="text-xs text-muted-foreground font-mono">
                  Receive alerts about financial activity
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none border border-border peer-checked:after:translate-x-full peer-checked:after:border-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-sm font-bold">Budget Alerts</div>
                <div className="text-xs text-muted-foreground font-mono">
                  Alert when category budgets are exceeded
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={budgetAlerts}
                  onChange={(e) => setBudgetAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none border border-border peer-checked:after:translate-x-full peer-checked:after:border-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Display Preferences */}
        <div className="border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold font-mono uppercase">DISPLAY PREFERENCES</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="border border-border bg-background p-2 font-mono text-sm w-full md:w-64"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="AUD">AUD - Australian Dollar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">
                Theme
              </label>
              <div className="text-xs text-muted-foreground font-mono">
                Use the theme toggle in the sidebar to switch between light and dark mode
              </div>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold font-mono uppercase">ACCOUNT</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">
                User ID
              </label>
              <input
                type="text"
                value="default_user"
                disabled
                className="border border-border bg-muted p-2 font-mono text-sm w-full md:w-96 text-muted-foreground"
              />
              <div className="text-xs text-muted-foreground font-mono mt-1">
                Multi-user support coming soon
              </div>
            </div>

            <div>
              <button className="border border-destructive text-destructive px-4 py-2 hover:bg-destructive/10 transition-colors font-mono text-sm">
                Clear All Data
              </button>
              <div className="text-xs text-muted-foreground font-mono mt-1">
                Warning: This will delete all transactions, accounts, and loans
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            className="border border-border bg-accent text-accent-foreground px-6 py-3 hover:opacity-80 transition-opacity font-mono text-sm uppercase font-bold"
          >
            Save Settings
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
