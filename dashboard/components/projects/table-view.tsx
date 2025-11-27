'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  MoreHorizontal,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { ProjectCard, ProjectColumn } from '@/lib/database-projects';

interface TableViewProps {
  cards: ProjectCard[];
  columns: ProjectColumn[];
  onCardClick: (card: ProjectCard) => void;
  onUpdateCard: (cardId: string, updates: Partial<ProjectCard>) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
}

type SortField = 'title' | 'column' | 'priority' | 'due_date' | 'created_at' | 'status';
type SortDirection = 'asc' | 'desc';

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

export function TableView({
  cards,
  columns,
  onCardClick,
  onUpdateCard,
  onDeleteCard,
}: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterColumn, setFilterColumn] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const getColumnName = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    return column?.name || 'Unknown';
  };

  const getColumnColor = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    return column?.color || '#6b7280';
  };

  const getColumnPosition = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    return column?.position ?? 999;
  };

  // Filter and sort cards
  const filteredAndSortedCards = useMemo(() => {
    let result = [...cards];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (card) =>
          card.title.toLowerCase().includes(query) ||
          card.description?.toLowerCase().includes(query)
      );
    }

    // Apply column filter
    if (filterColumn !== 'all') {
      result = result.filter((card) => card.column_id === filterColumn);
    }

    // Apply priority filter
    if (filterPriority !== 'all') {
      result = result.filter((card) => card.priority === filterPriority);
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'completed') {
        result = result.filter((card) => card.is_completed);
      } else if (filterStatus === 'active') {
        result = result.filter((card) => !card.is_completed);
      } else if (filterStatus === 'overdue') {
        const today = new Date().toISOString().split('T')[0];
        result = result.filter(
          (card) => !card.is_completed && card.due_date && card.due_date < today
        );
      }
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'column':
          comparison = getColumnPosition(a.column_id) - getColumnPosition(b.column_id);
          break;
        case 'priority':
          const aPriority = a.priority ? PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] : 4;
          const bPriority = b.priority ? PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] : 4;
          comparison = aPriority - bPriority;
          break;
        case 'due_date':
          if (!a.due_date && !b.due_date) comparison = 0;
          else if (!a.due_date) comparison = 1;
          else if (!b.due_date) comparison = -1;
          else comparison = a.due_date.localeCompare(b.due_date);
          break;
        case 'created_at':
          comparison = (a.created_at || '').localeCompare(b.created_at || '');
          break;
        case 'status':
          comparison = (a.is_completed ? 1 : 0) - (b.is_completed ? 1 : 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [cards, searchQuery, filterColumn, filterPriority, filterStatus, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUp className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-accent" />
    ) : (
      <ChevronDown className="w-3 h-3 text-accent" />
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isOverdue = (dueDate?: string, isCompleted?: boolean) => {
    if (!dueDate || isCompleted) return false;
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  const toggleComplete = async (e: React.MouseEvent, card: ProjectCard) => {
    e.stopPropagation();
    await onUpdateCard(card.id!, { is_completed: !card.is_completed });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterColumn('all');
    setFilterPriority('all');
    setFilterStatus('all');
  };

  const hasActiveFilters = searchQuery || filterColumn !== 'all' || filterPriority !== 'all' || filterStatus !== 'all';

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full bg-background border border-border pl-10 pr-4 py-2 font-mono text-sm"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 border border-border font-mono text-xs uppercase hover:bg-muted ${
            hasActiveFilters ? 'bg-accent/10 border-accent' : ''
          }`}
        >
          <Filter className="w-4 h-4" />
          FILTERS
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-accent rounded-full" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2 border border-border font-mono text-xs uppercase hover:bg-muted text-muted-foreground"
          >
            <X className="w-4 h-4" />
            CLEAR
          </button>
        )}

        <div className="text-xs text-muted-foreground font-mono">
          {filteredAndSortedCards.length} / {cards.length} tasks
        </div>
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="flex items-center gap-4 p-4 bg-muted/30 border border-border">
          <div className="flex items-center gap-2">
            <label className="font-mono text-xs text-muted-foreground">COLUMN:</label>
            <select
              value={filterColumn}
              onChange={(e) => setFilterColumn(e.target.value)}
              className="bg-background border border-border px-3 py-1 font-mono text-xs"
            >
              <option value="all">All</option>
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-mono text-xs text-muted-foreground">PRIORITY:</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-background border border-border px-3 py-1 font-mono text-xs"
            >
              <option value="all">All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-mono text-xs text-muted-foreground">STATUS:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-background border border-border px-3 py-1 font-mono text-xs"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 py-3 px-4">
                <span className="sr-only">Status</span>
              </th>
              <th
                onClick={() => handleSort('title')}
                className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4 cursor-pointer hover:text-foreground group"
              >
                <div className="flex items-center gap-2">
                  TITLE
                  <SortIcon field="title" />
                </div>
              </th>
              <th
                onClick={() => handleSort('column')}
                className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4 cursor-pointer hover:text-foreground group"
              >
                <div className="flex items-center gap-2">
                  COLUMN
                  <SortIcon field="column" />
                </div>
              </th>
              <th
                onClick={() => handleSort('priority')}
                className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4 cursor-pointer hover:text-foreground group"
              >
                <div className="flex items-center gap-2">
                  PRIORITY
                  <SortIcon field="priority" />
                </div>
              </th>
              <th
                onClick={() => handleSort('due_date')}
                className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4 cursor-pointer hover:text-foreground group"
              >
                <div className="flex items-center gap-2">
                  DUE DATE
                  <SortIcon field="due_date" />
                </div>
              </th>
              <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">
                EST. HOURS
              </th>
              <th
                onClick={() => handleSort('created_at')}
                className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4 cursor-pointer hover:text-foreground group"
              >
                <div className="flex items-center gap-2">
                  CREATED
                  <SortIcon field="created_at" />
                </div>
              </th>
              <th className="w-10 py-3 px-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedCards.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground font-mono">
                  {hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'}
                </td>
              </tr>
            ) : (
              filteredAndSortedCards.map((card) => (
                <tr
                  key={card.id}
                  onClick={() => onCardClick(card)}
                  className={`border-t border-border hover:bg-muted/30 cursor-pointer group ${
                    card.is_completed ? 'opacity-60' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <button
                      onClick={(e) => toggleComplete(e, card)}
                      className="hover:scale-110 transition-transform"
                    >
                      {card.is_completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground hover:text-accent" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className={`font-mono text-sm ${card.is_completed ? 'line-through' : ''}`}>
                      {card.title}
                    </div>
                    {card.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {card.description}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="px-2 py-1 font-mono text-xs"
                      style={{ backgroundColor: getColumnColor(card.column_id) + '30' }}
                    >
                      {getColumnName(card.column_id)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {card.priority ? (
                      <span
                        className={`px-2 py-1 font-mono text-xs text-white ${PRIORITY_COLORS[card.priority]}`}
                      >
                        {card.priority.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-mono text-xs flex items-center gap-1 ${
                        isOverdue(card.due_date, card.is_completed) ? 'text-destructive' : ''
                      }`}
                    >
                      {card.due_date && <Calendar className="w-3 h-3" />}
                      {formatDate(card.due_date)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {card.estimated_hours ? (
                      <span className="font-mono text-xs flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {card.estimated_hours}h
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDate(card.created_at)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCard(card.id!);
                      }}
                      className="p-1 hover:bg-destructive/10 rounded-sm text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold font-mono">{cards.length}</div>
          <div className="text-xs text-muted-foreground font-mono">TOTAL</div>
        </div>
        <div className="border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold font-mono text-green-500">
            {cards.filter((c) => c.is_completed).length}
          </div>
          <div className="text-xs text-muted-foreground font-mono">COMPLETED</div>
        </div>
        <div className="border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold font-mono text-yellow-500">
            {cards.filter((c) => !c.is_completed).length}
          </div>
          <div className="text-xs text-muted-foreground font-mono">ACTIVE</div>
        </div>
        <div className="border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold font-mono text-red-500">
            {cards.filter((c) => isOverdue(c.due_date, c.is_completed)).length}
          </div>
          <div className="text-xs text-muted-foreground font-mono">OVERDUE</div>
        </div>
      </div>
    </div>
  );
}
