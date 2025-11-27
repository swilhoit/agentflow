'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Tag,
  CheckCircle2,
  Circle,
  Trash2,
  Save,
  User,
  AlignLeft,
  Layout,
  MoreHorizontal,
  Flag
} from 'lucide-react';
import { ProjectCard, ProjectColumn } from '@/lib/database-projects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface CardDetailModalProps {
  card: ProjectCard | null;
  columns: ProjectColumn[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (cardId: string, updates: Partial<ProjectCard>) => Promise<void>;
  onDelete: (cardId: string) => Promise<void>;
}

const PRIORITIES = [
  { value: '', label: 'None', color: 'bg-muted text-muted-foreground' },
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
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
      setDueDate(card.due_date ? new Date(card.due_date).toISOString().split('T')[0] : '');
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-background w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border/50 bg-muted/10">
          <div className="flex-1 mr-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Layout className="w-4 h-4" />
              <span className="font-medium">{columns.find(c => c.id === columnId)?.name || 'Task'}</span>
              <span>/</span>
              <span className="font-mono text-xs opacity-70">CARD-{card.id?.slice(0, 4)}</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-2xl font-bold text-foreground border-none focus:ring-0 p-0 placeholder:text-muted-foreground/50"
              placeholder="Task title"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleDelete} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row">
            {/* Main Content (Left) */}
            <div className="flex-1 p-6 space-y-8 border-r border-border/50 min-h-[400px]">
              {/* Description */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <AlignLeft className="w-4 h-4" />
                  Description
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[200px] bg-muted/30 border border-border rounded-md p-4 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Add a more detailed description..."
                />
              </div>

              {/* Activity / Comments (Placeholder) */}
              <div className="space-y-3 pt-6 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <ActivityIcon className="w-4 h-4" />
                  Activity
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    ME
                  </div>
                  <div className="flex-1">
                    <div className="bg-muted/30 border border-border rounded-md p-3 text-sm text-muted-foreground">
                      Comment functionality coming soon...
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar (Right) */}
            <div className="w-full md:w-80 bg-muted/5 p-6 space-y-6">
              {/* Status */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                <div className="flex flex-col gap-2">
                  <select
                    value={columnId}
                    onChange={(e) => setColumnId(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => setIsCompleted(!isCompleted)}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                      isCompleted 
                        ? 'bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20' 
                        : 'bg-background border-border hover:bg-muted'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    {isCompleted ? 'Completed' : 'Mark Complete'}
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</label>
                  
                  {/* Priority */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Flag className="w-4 h-4" />
                      Priority
                    </div>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="bg-transparent text-sm text-right focus:outline-none cursor-pointer hover:text-primary"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Assignee */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      Assignee
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        ME
                      </div>
                      <span className="text-sm">Me</span>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      Due Date
                    </div>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="bg-transparent text-sm text-right focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Time Tracking */}
              <div className="space-y-2 pt-4 border-t border-border/50">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time Tracking</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Estimated</span>
                    <div className="relative">
                      <Clock className="absolute left-2 top-2 w-3 h-3 text-muted-foreground" />
                      <input
                        type="number"
                        value={estimatedHours}
                        onChange={(e) => setEstimatedHours(e.target.value)}
                        className="w-full bg-background border border-border rounded-md pl-7 pr-2 py-1.5 text-sm"
                        placeholder="0h"
                        step="0.5"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Actual</span>
                    <div className="relative">
                      <Clock className="absolute left-2 top-2 w-3 h-3 text-muted-foreground" />
                      <input
                        type="number"
                        value={actualHours}
                        onChange={(e) => setActualHours(e.target.value)}
                        className="w-full bg-background border border-border rounded-md pl-7 pr-2 py-1.5 text-sm"
                        placeholder="0h"
                        step="0.5"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div className="space-y-2 pt-4 border-t border-border/50">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Labels</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {labels.map((label) => (
                    <Badge key={label} variant="secondary" className="px-2 py-1 gap-1">
                      {label}
                      <button onClick={() => removeLabel(label)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/20"
                    placeholder="New label..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLabel();
                      }
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={addLabel}>Add</Button>
                </div>
              </div>

              {/* Meta */}
              <div className="pt-4 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                {card.created_at && <p>Created {formatDate(card.created_at)}</p>}
                {card.updated_at && <p>Updated {formatDate(card.updated_at)}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 bg-muted/10 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
