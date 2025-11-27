'use client';

import React, { useState } from 'react';
import {
  Plus,
  MoreHorizontal,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  GripVertical,
  Trash2,
  Edit2,
  X,
} from 'lucide-react';
import { ProjectCard, ProjectColumn } from '@/lib/database-projects';

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

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'LOW',
  medium: 'MED',
  high: 'HIGH',
  urgent: 'URGENT',
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

  const isDueToday = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate).toDateString() === new Date().toDateString();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
      {columns.map((column) => (
        <div
          key={column.id}
          className={`flex-shrink-0 w-72 bg-muted/30 border border-border rounded-sm flex flex-col ${
            dragOverColumn === column.id ? 'ring-2 ring-accent' : ''
          }`}
          onDragOver={(e) => handleDragOver(e, column.id!)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id!)}
        >
          {/* Column Header */}
          <div className="p-3 border-b border-border flex items-center justify-between">
            {editingColumn === column.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editColumnName}
                  onChange={(e) => setEditColumnName(e.target.value)}
                  className="flex-1 bg-background border border-border px-2 py-1 font-mono text-xs uppercase"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditColumn(column.id!);
                    if (e.key === 'Escape') setEditingColumn(null);
                  }}
                />
                <button
                  onClick={() => handleEditColumn(column.id!)}
                  className="text-accent hover:text-accent/80"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingColumn(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: column.color || '#6b7280' }}
                  />
                  <span className="font-mono text-xs font-bold uppercase">{column.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    ({column.cards.length})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingColumn(column.id!);
                      setEditColumnName(column.name);
                    }}
                    className="p-1 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteColumn(column.id!)}
                    className="p-1 hover:bg-destructive/10 rounded-sm text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Cards */}
          <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[500px]">
            {column.cards.map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => handleDragStart(e, card)}
                onDragEnd={handleDragEnd}
                onClick={() => onCardClick(card)}
                className={`bg-card border border-border p-3 cursor-pointer hover:border-accent/50 transition-all group ${
                  draggedCard?.id === card.id ? 'opacity-50' : ''
                } ${card.is_completed ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                    {card.is_completed && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCard(card.id!);
                    }}
                    className="p-1 hover:bg-destructive/10 rounded-sm text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <h4 className={`font-mono text-sm mb-2 ${card.is_completed ? 'line-through' : ''}`}>
                  {card.title}
                </h4>

                {card.description && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {card.description}
                  </p>
                )}

                <div className="flex items-center flex-wrap gap-2">
                  {card.priority && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono text-white ${PRIORITY_COLORS[card.priority]}`}
                    >
                      {PRIORITY_LABELS[card.priority]}
                    </span>
                  )}

                  {card.due_date && (
                    <span
                      className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono ${
                        isOverdue(card.due_date)
                          ? 'bg-destructive/20 text-destructive'
                          : isDueToday(card.due_date)
                          ? 'bg-yellow-500/20 text-yellow-600'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      {formatDate(card.due_date)}
                    </span>
                  )}

                  {card.estimated_hours && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {card.estimated_hours}h
                    </span>
                  )}
                </div>

                {card.labels && card.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {card.labels.map((label, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 text-[10px] font-mono bg-accent/20 text-accent"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Add Card Form */}
            {addingCardToColumn === column.id ? (
              <div className="bg-card border border-border p-3">
                <textarea
                  value={newCardTitle[column.id!] || ''}
                  onChange={(e) =>
                    setNewCardTitle((prev) => ({
                      ...prev,
                      [column.id!]: e.target.value,
                    }))
                  }
                  placeholder="Enter card title..."
                  className="w-full bg-background border border-border p-2 font-mono text-sm resize-none"
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
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleAddCard(column.id!)}
                    className="px-3 py-1 bg-accent text-accent-foreground font-mono text-xs uppercase hover:opacity-80"
                  >
                    ADD CARD
                  </button>
                  <button
                    onClick={() => setAddingCardToColumn(null)}
                    className="px-3 py-1 border border-border font-mono text-xs uppercase hover:bg-muted"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingCardToColumn(column.id!)}
                className="w-full p-2 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-accent/50 font-mono text-xs flex items-center justify-center gap-2"
              >
                <Plus className="w-3 h-3" />
                ADD CARD
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add Column */}
      <div className="flex-shrink-0 w-72">
        {addingColumn ? (
          <div className="bg-muted/30 border border-border rounded-sm p-3">
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Enter column name..."
              className="w-full bg-background border border-border px-3 py-2 font-mono text-sm uppercase"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddColumn();
                if (e.key === 'Escape') setAddingColumn(false);
              }}
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleAddColumn}
                className="px-3 py-1 bg-accent text-accent-foreground font-mono text-xs uppercase hover:opacity-80"
              >
                ADD COLUMN
              </button>
              <button
                onClick={() => setAddingColumn(false)}
                className="px-3 py-1 border border-border font-mono text-xs uppercase hover:bg-muted"
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingColumn(true)}
            className="w-full p-4 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-accent/50 font-mono text-sm flex items-center justify-center gap-2 rounded-sm"
          >
            <Plus className="w-4 h-4" />
            ADD COLUMN
          </button>
        )}
      </div>
    </div>
  );
}
