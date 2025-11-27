'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { ProjectCard, ProjectColumn } from '@/lib/database-projects';

interface CalendarViewProps {
  cards: ProjectCard[];
  columns: ProjectColumn[];
  onCardClick: (card: ProjectCard) => void;
  onAddCard: (columnId: string, title: string, dueDate: string) => Promise<void>;
  onUpdateCard: (cardId: string, updates: Partial<ProjectCard>) => Promise<void>;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'border-l-gray-500',
  medium: 'border-l-yellow-500',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500',
};

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function CalendarView({
  cards,
  columns,
  onCardClick,
  onAddCard,
  onUpdateCard,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [addingToDate, setAddingToDate] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');

  // Get the start of the week (Sunday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Get array of 7 days for the current week
  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  }, [currentDate]);

  // Group cards by date
  const cardsByDate = useMemo(() => {
    const grouped: Record<string, ProjectCard[]> = {};
    cards.forEach((card) => {
      if (card.due_date) {
        const dateKey = card.due_date.split('T')[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(card);
      }
    });
    return grouped;
  }, [cards]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatWeekRange = () => {
    const start = weekDays[0];
    const end = weekDays[6];
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const year = end.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${year}`;
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleAddCard = async (dateKey: string) => {
    if (!newCardTitle.trim()) return;

    // Find the first column (backlog or todo) to add to
    const targetColumn = columns.find((c) =>
      c.name.toLowerCase().includes('todo') || c.name.toLowerCase().includes('backlog')
    ) || columns[0];

    if (targetColumn?.id) {
      await onAddCard(targetColumn.id, newCardTitle.trim(), dateKey);
    }

    setNewCardTitle('');
    setAddingToDate(null);
  };

  const getColumnName = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    return column?.name || 'Unknown';
  };

  const getColumnColor = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    return column?.color || '#6b7280';
  };

  // Get cards without due dates
  const unscheduledCards = cards.filter((card) => !card.due_date);

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="font-mono text-lg font-bold uppercase">{formatWeekRange()}</h3>
          <button
            onClick={goToToday}
            className="px-3 py-1 border border-border font-mono text-xs uppercase hover:bg-muted"
          >
            TODAY
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 border border-border hover:bg-muted"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 border border-border hover:bg-muted"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => {
          const dateKey = formatDateKey(day);
          const dayCards = cardsByDate[dateKey] || [];
          const isCurrentDay = isToday(day);
          const isPastDay = isPast(day);

          return (
            <div
              key={dateKey}
              className={`border border-border min-h-[200px] flex flex-col ${
                isCurrentDay ? 'bg-accent/5 border-accent' : isPastDay ? 'bg-muted/30' : 'bg-card'
              }`}
            >
              {/* Day Header */}
              <div
                className={`p-2 border-b border-border ${
                  isCurrentDay ? 'bg-accent text-accent-foreground' : ''
                }`}
              >
                <div className="font-mono text-xs text-muted-foreground">
                  {DAYS_OF_WEEK[index]}
                </div>
                <div className={`font-mono text-lg font-bold ${isCurrentDay ? '' : ''}`}>
                  {day.getDate()}
                </div>
              </div>

              {/* Day Cards */}
              <div className="flex-1 p-2 space-y-1 overflow-y-auto">
                {dayCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => onCardClick(card)}
                    className={`p-2 bg-muted/50 border-l-2 cursor-pointer hover:bg-muted transition-colors ${
                      card.priority ? PRIORITY_COLORS[card.priority] : 'border-l-gray-400'
                    } ${card.is_completed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-1">
                      {card.is_completed && (
                        <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`font-mono text-xs line-clamp-2 ${
                          card.is_completed ? 'line-through' : ''
                        }`}
                      >
                        {card.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-mono px-1 py-0.5"
                        style={{ backgroundColor: getColumnColor(card.column_id) + '30' }}
                      >
                        {getColumnName(card.column_id)}
                      </span>
                      {card.estimated_hours && (
                        <span className="flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground">
                          <Clock className="w-2 h-2" />
                          {card.estimated_hours}h
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add Card to Date */}
                {addingToDate === dateKey ? (
                  <div className="p-2 bg-card border border-border">
                    <input
                      type="text"
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      placeholder="Task title..."
                      className="w-full bg-background border border-border px-2 py-1 font-mono text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCard(dateKey);
                        if (e.key === 'Escape') setAddingToDate(null);
                      }}
                    />
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => handleAddCard(dateKey)}
                        className="px-2 py-0.5 bg-accent text-accent-foreground font-mono text-[10px] uppercase"
                      >
                        ADD
                      </button>
                      <button
                        onClick={() => setAddingToDate(null)}
                        className="px-2 py-0.5 border border-border font-mono text-[10px] uppercase"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingToDate(dateKey)}
                    className="w-full p-1 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-accent/50 font-mono text-[10px] flex items-center justify-center gap-1"
                  >
                    <Plus className="w-2 h-2" />
                    ADD
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled Cards */}
      {unscheduledCards.length > 0 && (
        <div className="border border-border bg-card p-4">
          <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            UNSCHEDULED ({unscheduledCards.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {unscheduledCards.slice(0, 12).map((card) => (
              <div
                key={card.id}
                onClick={() => onCardClick(card)}
                className={`p-2 bg-muted/50 border border-border cursor-pointer hover:border-accent/50 ${
                  card.is_completed ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-1">
                  {card.is_completed && (
                    <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                  )}
                  <span
                    className={`font-mono text-xs line-clamp-2 ${
                      card.is_completed ? 'line-through' : ''
                    }`}
                  >
                    {card.title}
                  </span>
                </div>
                <span
                  className="text-[10px] font-mono px-1 py-0.5 mt-1 inline-block"
                  style={{ backgroundColor: getColumnColor(card.column_id) + '30' }}
                >
                  {getColumnName(card.column_id)}
                </span>
              </div>
            ))}
            {unscheduledCards.length > 12 && (
              <div className="p-2 bg-muted/30 border border-dashed border-border flex items-center justify-center">
                <span className="font-mono text-xs text-muted-foreground">
                  +{unscheduledCards.length - 12} more
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
