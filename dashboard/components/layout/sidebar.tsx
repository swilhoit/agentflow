'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '../theme-toggle';
import {
  Home,
  DollarSign,
  TrendingUp,
  CreditCard,
  Briefcase,
  Target,
  CheckSquare,
  Settings,
  BarChart3
} from 'lucide-react';

const navigation = [
  { name: 'DASHBOARD', href: '/', icon: Home },
  { name: 'FINANCES', href: '/finances', icon: DollarSign, children: [
    { name: 'Income', href: '/finances/income' },
    { name: 'Business', href: '/finances/business' },
  ]},
  { name: 'LOANS', href: '/loans', icon: CreditCard },
  { name: 'INVESTMENTS', href: '/investments', icon: TrendingUp },
  { name: 'GOALS', href: '/goals', icon: Target },
  { name: 'TASKS', href: '/tasks', icon: CheckSquare },
  { name: 'ANALYTICS', href: '/analytics', icon: BarChart3 },
  { name: 'SETTINGS', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 border-r border-border bg-card h-screen fixed left-0 top-0 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold font-mono uppercase">AGENTFLOW</h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">Personal Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <div key={item.name}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 font-mono text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
              {item.children && isActive && (
                <div className="ml-10 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.name}
                      href={child.href}
                      className={`block px-3 py-1 font-mono text-xs transition-colors ${
                        pathname === child.href
                          ? 'text-accent'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border flex items-center justify-between">
        <div className="text-xs text-muted-foreground font-mono">v1.0.0</div>
        <ThemeToggle />
      </div>
    </div>
  );
}
