'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '../theme-toggle';
import {
  Home,
  DollarSign,
  TrendingUp,
  CreditCard,
  Target,
  Settings,
  BarChart3,
  Bot,
  Activity,
  LogOut,
  LineChart,
  FolderKanban,
  ChevronRight,
  Zap,
  Wallet,
  PieChart,
  Search,
  Command,
  CalendarDays,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: Array<{ name: string; href: string }>;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    // Main section - no label, always visible
    items: [
      { name: 'Dashboard', href: '/', icon: Home },
      { name: 'Projects', href: '/projects', icon: FolderKanban },
    ]
  },
  {
    label: 'Automation',
    items: [
      {
        name: 'Agents',
        href: '/agents',
        icon: Bot,
        children: [
          { name: 'Tasks', href: '/agents/tasks' },
          { name: 'Executions', href: '/agents/executions' },
          { name: 'Logs', href: '/agents/logs' },
        ]
      },
    ]
  },
  {
    label: 'Finance',
    items: [
      {
        name: 'Overview',
        href: '/finances',
        icon: Wallet,
        children: [
          { name: 'Income', href: '/finances/income' },
          { name: 'Business', href: '/finances/business' },
        ]
      },
      { name: 'Loans', href: '/loans', icon: CreditCard },
      { name: 'Trading', href: '/trading', icon: LineChart },
      { name: 'VIX Trading', href: '/vix-trading', icon: Gauge },
      { name: 'Calendar', href: '/calendar', icon: CalendarDays },
      { name: 'Investments', href: '/investments', icon: TrendingUp },
      { name: 'Goals', href: '/goals', icon: Target },
      { name: 'Spending Analytics', href: '/analytics', icon: PieChart },
    ]
  },
  {
    label: 'Insights',
    items: [
      { name: 'Diagnostics', href: '/diagnostics', icon: Activity },
    ]
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Automation', 'Finance', 'Insights']));

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    window.location.href = '/login';
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const toggleSection = (label: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <div className="w-60 border-r border-border bg-background h-screen fixed left-0 top-0 flex flex-col z-50 shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold">AgentFlow</h1>
          </div>
        </div>
      </div>

      {/* Quick Search */}
      <div className="px-3 py-2">
        <button
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md',
            'text-xs text-muted-foreground',
            'bg-muted/50 hover:bg-muted transition-colors'
          )}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Quick search...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-background border border-border text-[10px]">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-4 overflow-y-auto">
        {navigation.map((section, sectionIndex) => {
          const isSectionExpanded = !section.label || expandedSections.has(section.label);

          return (
            <div key={sectionIndex}>
              {/* Section Header */}
              {section.label && (
                <button
                  onClick={() => toggleSection(section.label!)}
                  className={cn(
                    'w-full flex items-center gap-1 px-3 py-1.5 mb-1',
                    'text-[11px] font-medium text-muted-foreground uppercase tracking-wider',
                    'hover:text-foreground transition-colors'
                  )}
                >
                  <ChevronRight
                    className={cn(
                      'w-3 h-3 transition-transform',
                      isSectionExpanded && 'rotate-90'
                    )}
                  />
                  {section.label}
                </button>
              )}

              {/* Section Items */}
              {isSectionExpanded && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    const hasChildren = item.children && item.children.length > 0;
                    const showChildren = hasChildren && active;

                    return (
                      <div key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                            'hover:bg-muted',
                            active
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground'
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="flex-1">{item.name}</span>
                          {hasChildren && (
                            <ChevronRight
                              className={cn(
                                'h-3 w-3 transition-transform',
                                showChildren && 'rotate-90'
                              )}
                            />
                          )}
                        </Link>

                        {/* Children */}
                        {showChildren && (
                          <div className="ml-6 mt-1 space-y-0.5 border-l border-border pl-3">
                            {item.children?.map((child) => (
                              <Link
                                key={child.name}
                                href={child.href}
                                className={cn(
                                  'block px-3 py-1.5 rounded-md text-xs transition-colors',
                                  'hover:bg-muted',
                                  pathname === child.href
                                    ? 'text-primary font-medium'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {child.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-1">
        {/* Settings */}
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
            'hover:bg-muted',
            pathname === '/settings'
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>

        {/* Theme & Version */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-muted-foreground">v1.0.0</span>
          <ThemeToggle />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm',
            'text-muted-foreground',
            'hover:bg-destructive/10 hover:text-destructive',
            'transition-colors'
          )}
        >
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
