'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon, Target, DollarSign, Bell, User, Palette, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            title="Settings"
            description="Customize your dashboard preferences and financial goals"
            icon={<SettingsIcon className="w-6 h-6" />}
          />

          <div className="space-y-6">
            {/* Financial Goals Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <CardTitle>Financial Goals</CardTitle>
                </div>
                <CardDescription>Set your monthly targets for income, expenses, and savings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Monthly Income Target
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={monthlyIncome}
                        onChange={(e) => setMonthlyIncome(e.target.value)}
                        className="w-full h-9 pl-7 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Monthly Expense Limit
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={monthlyExpenses}
                        onChange={(e) => setMonthlyExpenses(e.target.value)}
                        className="w-full h-9 pl-7 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Target Savings Rate
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={savingsRate}
                        onChange={(e) => setSavingsRate(e.target.value)}
                        className="w-full h-9 pl-3 pr-7 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category Budgets Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <CardTitle>Category Budgets</CardTitle>
                </div>
                <CardDescription>Set spending limits for each category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(categoryBudgets).map(([category, value]) => (
                    <div key={category}>
                      <label className="text-sm font-medium mb-2 block">
                        {category}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => handleCategoryBudgetChange(category, e.target.value)}
                          className="w-full h-9 pl-7 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notifications Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <CardTitle>Notifications</CardTitle>
                </div>
                <CardDescription>Manage your notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Enable Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Receive alerts about financial activity
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={notifications}
                    onChange={setNotifications}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Budget Alerts</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified when category budgets are exceeded
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={budgetAlerts}
                    onChange={setBudgetAlerts}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Display Preferences */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  <CardTitle>Display Preferences</CardTitle>
                </div>
                <CardDescription>Customize how data is displayed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full md:w-64 h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                  <label className="text-sm font-medium mb-2 block">
                    Theme
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Use the theme toggle in the sidebar to switch between light and dark mode
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Account Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <CardTitle>Account</CardTitle>
                </div>
                <CardDescription>Manage your account settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    User ID
                  </label>
                  <input
                    type="text"
                    value="default_user"
                    disabled
                    className="w-full md:w-96 h-9 px-3 rounded-md border border-input bg-muted text-muted-foreground text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Multi-user support coming soon
                  </p>
                </div>

                <div className="pt-4 border-t border-border">
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Data
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Warning: This will delete all transactions, accounts, and loans
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleSaveSettings}>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Toggle Switch Component
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}
