'use client';

import React, { useState } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  GripVertical,
  Trash2,
  Edit2,
  X,
  MoreHorizontal
} from 'lucide-react';
import { ProjectCard, ProjectColumn } from '@/lib/database-projects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BoardColumn extends ProjectColumn {
  cards: ProjectCard[];
}

interface BoardViewProps {
  columns: BoardColumn[];
  onAddCard: (columnId: string, title: string) => Promise<void>;
  onUpdateCard: (cardId: string, updates: Partial<ProjectCard>) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onMoveCard: (cardId: string, targetColumnId: string, position: number) => Promise<void>;
  onAddColumn: (name: string) => Promise<void>;
  onUpdateColumn: (columnId: string, updates: Partial<ProjectColumn>) => Promise<void>;
  onDeleteColumn: (columnId: string) => Promise<void>;
  onCardClick: (card: ProjectCard) => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  medium: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  high: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  urgent: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
};

export function BoardView({
  columns,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onMoveCard,
  onAddColumn,
  onUpdateColumn,
  onDeleteColumn,
  onCardClick,
}: BoardViewProps) {
  const [newCardTitle, setNewCardTitle] = useState<Record<string, string>>({});
  const [addingCardToColumn, setAddingCardToColumn] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editColumnName, setEditColumnName] = useState('');
  const [draggedCard, setDraggedCard] = useState<ProjectCard | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleAddCard = async (columnId: string) => {
    const title = newCardTitle[columnId]?.trim();
    if (!title) return;

    await onAddCard(columnId, title);
    setNewCardTitle((prev) => ({ ...prev, [columnId]: '' }));
    setAddingCardToColumn(null);
  };

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    await onAddColumn(newColumnName.trim());
    setNewColumnName('');
    setAddingColumn(false);
  };

  const handleEditColumn = async (columnId: string) => {
    if (!editColumnName.trim()) return;
    await onUpdateColumn(columnId, { name: editColumnName.trim() });
    setEditingColumn(null);
    setEditColumnName('');
  };

  const handleDragStart = (e: React.DragEvent, card: ProjectCard) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id || '');
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedCard || !draggedCard.id) return;

    const targetColumn = columns.find((c) => c.id === targetColumnId);
    const newPosition = targetColumn?.cards.length || 0;

    await onMoveCard(draggedCard.id, targetColumnId, newPosition);
    setDraggedCard(null);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverColumn(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-8 min-h-[calc(100vh-200px)]">
      {columns.map((column) => (
        <div
          key={column.id}
          className={cn(
            "flex-shrink-0 w-80 flex flex-col rounded-xl transition-colors",
            dragOverColumn === column.id ? "bg-accent/10" : "bg-secondary/30"
          )}
          onDragOver={(e) => handleDragOver(e, column.id!)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id!)}
        >
          {/* Column Header */}
          <div className="p-4 flex items-center justify-between group/header">
            {editingColumn === column.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editColumnName}
                  onChange={(e) => setEditColumnName(e.target.value)}
                  className="flex-1 bg-background border border-border px-2 py-1 rounded-md text-sm font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditColumn(column.id!);
                    if (e.key === 'Escape') setEditingColumn(null);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditColumn(column.id!)}>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingColumn(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-foreground">{column.name}</span>
                  <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 bg-background/50 rounded-full">
                    {column.cards.length}
                  </span>
                </div>
                <div className="flex items-center opacity-0 group-hover/header:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      setEditingColumn(column.id!);
                      setEditColumnName(column.name);
                    }}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:text-destructive"
                    onClick={() => onDeleteColumn(column.id!)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Cards */}
          <div className="flex-1 px-3 pb-3 space-y-3 overflow-y-auto">
            {column.cards.map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => handleDragStart(e, card)}
                onDragEnd={handleDragEnd}
                onClick={() => onCardClick(card)}
                className={cn(
                  "bg-background p-4 rounded-lg shadow-sm border border-border/50 cursor-pointer hover:shadow-md hover:border-primary/20 transition-all group/card relative",
                  draggedCard?.id === card.id && "opacity-50 rotate-3 scale-95",
                  card.is_completed && "opacity-70 bg-muted/20"
                )}
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h4 className={cn("font-medium text-sm text-foreground leading-tight", card.is_completed && "line-through text-muted-foreground")}>
                    {card.title}
                  </h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCard(card.id!);
                    }}
                    className="opacity-0 group-hover/card:opacity-100 text-muted-foreground hover:text-destructive transition-opacity absolute top-2 right-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {card.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {card.description}
                  </p>
                )}

                <div className="flex items-center flex-wrap gap-2 mt-3">
                  {card.priority && (
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border", PRIORITY_STYLES[card.priority])}>
                      {card.priority.toUpperCase()}
                    </span>
                  )}

                  {card.due_date && (
                    <span className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border",
                      isOverdue(card.due_date) 
                        ? "bg-red-50 text-red-700 border-red-200" 
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    )}>
                      <Calendar className="w-3 h-3" />
                      {formatDate(card.due_date)}
                    </span>
                  )}

                  {card.labels?.map((label, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {/* Add Card Form */}
            {addingCardToColumn === column.id ? (
              <div className="bg-background p-3 rounded-lg border border-primary/30 shadow-sm">
                <textarea
                  value={newCardTitle[column.id!] || ''}
                  onChange={(e) =>
                    setNewCardTitle((prev) => ({
                      ...prev,
                      [column.id!]: e.target.value,
                    }))
                  }
                  placeholder="Enter card title..."
                  className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground/50"
                  rows={2}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddCard(column.id!);
                    }
                    if (e.key === 'Escape') {
                      setAddingCardToColumn(null);
                    }
                  }}
                />
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" onClick={() => handleAddCard(column.id!)}>Add Card</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingCardToColumn(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingCardToColumn(column.id!)}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-background/50 rounded-md flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Card
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add Column Button */}
      <div className="flex-shrink-0 w-80">
        {addingColumn ? (
          <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Column name..."
              className="w-full bg-background border border-border px-3 py-2 rounded-md text-sm mb-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddColumn();
                if (e.key === 'Escape') setAddingColumn(false);
              }}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleAddColumn}>Add Column</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingColumn(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingColumn(true)}
            className="w-full h-12 border-2 border-dashed border-border/50 hover:border-primary/50 text-muted-foreground hover:text-primary rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Column
          </button>
        )}
      </div>
    </div>
  );
}
