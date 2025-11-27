'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Tag,
  AlertCircle,
  CheckCircle2,
  Circle,
  Trash2,
  Save,
  User,
} from 'lucide-react';
import { ProjectCard, ProjectColumn } from '@/lib/database-projects';

interface CardDetailModalProps {
  card: ProjectCard | null;
  columns: ProjectColumn[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (cardId: string, updates: Partial<ProjectCard>) => Promise<void>;
  onDelete: (cardId: string) => Promise<void>;
}

const PRIORITIES = [
  { value: '', label: 'None', color: '' },
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
];

export function CardDetailModal({
  card,
  columns,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: CardDetailModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState('');
  const [priority, setPriority] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [actualHours, setActualHours] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || '');
      setColumnId(card.column_id);
      setPriority(card.priority || '');
      setDueDate(card.due_date || '');
      setEstimatedHours(card.estimated_hours?.toString() || '');
      setActualHours(card.actual_hours?.toString() || '');
      setLabels(card.labels || []);
      setIsCompleted(card.is_completed || false);
    }
  }, [card]);

  if (!isOpen || !card) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(card.id!, {
        title,
        description: description || undefined,
        column_id: columnId,
        priority: priority as ProjectCard['priority'] || undefined,
        due_date: dueDate || undefined,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        actual_hours: actualHours ? parseFloat(actualHours) : undefined,
        labels: labels.length > 0 ? labels : undefined,
        is_completed: isCompleted,
      });
      onClose();
    } catch (e) {
      console.error('Error saving card:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this card?')) {
      await onDelete(card.id!);
      onClose();
    }
  };

  const addLabel = () => {
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      setLabels([...labels, newLabel.trim()]);
      setNewLabel('');
    }
  };

  const removeLabel = (labelToRemove: string) => {
    setLabels(labels.filter((l) => l !== labelToRemove));
  };

  const getColumnColor = (id: string) => {
    const column = columns.find((c) => c.id === id);
    return column?.color || '#6b7280';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-card border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCompleted(!isCompleted)}
              className="hover:scale-110 transition-transform"
            >
              {isCompleted ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : (
                <Circle className="w-6 h-6 text-muted-foreground hover:text-accent" />
              )}
            </button>
            <span className="font-mono text-xs text-muted-foreground uppercase">
              {isCompleted ? 'COMPLETED' : 'ACTIVE'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent border-none text-xl font-bold font-mono focus:outline-none focus:ring-0"
              placeholder="Card title"
            />
          </div>

          {/* Column & Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground font-mono uppercase mb-2">
                COLUMN
              </label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 font-mono text-sm"
                style={{ borderLeftColor: getColumnColor(columnId), borderLeftWidth: '4px' }}
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground font-mono uppercase mb-2">
                PRIORITY
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 font-mono text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-muted-foreground font-mono uppercase mb-2">
              DESCRIPTION
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 font-mono text-sm resize-none"
              rows={4}
              placeholder="Add a description..."
            />
          </div>

          {/* Due Date & Hours Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground font-mono uppercase mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                DUE DATE
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground font-mono uppercase mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                EST. HOURS
              </label>
              <input
                type="number"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 font-mono text-sm"
                placeholder="0"
                min="0"
                step="0.5"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground font-mono uppercase mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                ACTUAL HOURS
              </label>
              <input
                type="number"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 font-mono text-sm"
                placeholder="0"
                min="0"
                step="0.5"
              />
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-xs text-muted-foreground font-mono uppercase mb-2 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              LABELS
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {labels.map((label) => (
                <span
                  key={label}
                  className="px-2 py-1 bg-accent/20 text-accent font-mono text-xs flex items-center gap-1"
                >
                  {label}
                  <button
                    onClick={() => removeLabel(label)}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="flex-1 bg-background border border-border px-3 py-2 font-mono text-sm"
                placeholder="Add a label..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLabel();
                  }
                }}
              />
              <button
                onClick={addLabel}
                className="px-3 py-2 border border-border font-mono text-xs uppercase hover:bg-muted"
              >
                ADD
              </button>
            </div>
          </div>

          {/* Metadata */}
          {card.created_at && (
            <div className="text-xs text-muted-foreground font-mono pt-4 border-t border-border">
              <p>Created: {formatDate(card.created_at)}</p>
              {card.updated_at && <p>Updated: {formatDate(card.updated_at)}</p>}
              {card.completed_at && <p>Completed: {formatDate(card.completed_at)}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border font-mono text-xs uppercase hover:bg-muted"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 bg-accent text-accent-foreground font-mono text-xs uppercase hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>SAVING...</>
            ) : (
              <>
                <Save className="w-4 h-4" />
                SAVE CHANGES
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
