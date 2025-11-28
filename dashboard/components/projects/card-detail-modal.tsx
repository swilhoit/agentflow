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
  Flag,
  Bot,
  ArrowRight,
  Zap
} from 'lucide-react';
import { ProjectCard, ProjectColumn, CardActivity } from '@/lib/database-projects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface AgentConfig {
  agent_name: string;
  display_name: string;
  agent_type: string;
  status: string;
}

interface CardDetailModalProps {
  card: ProjectCard | null;
  columns: ProjectColumn[];
  agents?: AgentConfig[];
  activity?: CardActivity[];
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
  agents = [],
  activity = [],
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
  const [assignedAgent, setAssignedAgent] = useState('');
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
      setAssignedAgent(card.assigned_agent || '');
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
        assigned_agent: assignedAgent || undefined,
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

              {/* Activity History */}
              <div className="space-y-3 pt-6 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <ActivityIcon className="w-4 h-4" />
                  Activity
                </div>
                {activity.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {activity.map((act) => (
                      <ActivityItem key={act.id} activity={act} />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    No activity recorded yet
                  </div>
                )}
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

                  {/* Agent Assignment */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Bot className="w-4 h-4" />
                      Agent
                    </div>
                    <select
                      value={assignedAgent}
                      onChange={(e) => setAssignedAgent(e.target.value)}
                      className="bg-transparent text-sm text-right focus:outline-none cursor-pointer hover:text-primary max-w-[140px]"
                    >
                      <option value="">Unassigned</option>
                      {agents.map((agent) => (
                        <option key={agent.agent_name} value={agent.agent_name}>
                          {agent.display_name || agent.agent_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Show completed by agent if applicable */}
                  {card.is_completed && card.completed_by_agent && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Completed by
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                          <Bot className="w-3 h-3 text-green-700" />
                        </div>
                        <span className="text-sm text-green-700 font-medium">{card.completed_by_agent}</span>
                      </div>
                    </div>
                  )}

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

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  created: { label: 'created this task', icon: <Zap className="w-3 h-3" />, color: 'text-blue-600' },
  updated: { label: 'updated this task', icon: <AlignLeft className="w-3 h-3" />, color: 'text-slate-600' },
  moved: { label: 'moved this task', icon: <ArrowRight className="w-3 h-3" />, color: 'text-purple-600' },
  completed: { label: 'completed this task', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-600' },
  reopened: { label: 'reopened this task', icon: <Circle className="w-3 h-3" />, color: 'text-orange-600' },
  assigned: { label: 'assigned', icon: <Bot className="w-3 h-3" />, color: 'text-violet-600' },
  unassigned: { label: 'unassigned', icon: <User className="w-3 h-3" />, color: 'text-slate-600' },
  commented: { label: 'commented', icon: <AlignLeft className="w-3 h-3" />, color: 'text-blue-600' },
  priority_changed: { label: 'changed priority', icon: <Flag className="w-3 h-3" />, color: 'text-orange-600' },
  due_date_changed: { label: 'changed due date', icon: <Calendar className="w-3 h-3" />, color: 'text-blue-600' },
};

function ActivityItem({ activity }: { activity: CardActivity }) {
  const actionInfo = ACTION_LABELS[activity.action_type] || {
    label: activity.action_type,
    icon: <Zap className="w-3 h-3" />,
    color: 'text-muted-foreground',
  };

  const actor = activity.agent_name || activity.user_id || 'System';
  const isAgent = !!activity.agent_name;

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex gap-3 items-start">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
        isAgent
          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
          : 'bg-primary/10 text-primary'
      }`}>
        {isAgent ? <Bot className="w-3.5 h-3.5" /> : actor.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{actor}</span>
          <span className={`text-sm ${actionInfo.color}`}>{actionInfo.label}</span>
          {activity.from_value && activity.to_value && (
            <span className="text-xs text-muted-foreground">
              from <span className="font-medium">{activity.from_value}</span> to{' '}
              <span className="font-medium">{activity.to_value}</span>
            </span>
          )}
          {activity.to_value && !activity.from_value && activity.action_type === 'assigned' && (
            <span className="text-xs text-muted-foreground">
              to <span className="font-medium">{activity.to_value}</span>
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatTime(activity.created_at)}
        </div>
      </div>
    </div>
  );
}
