'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BoardView } from '@/components/projects/board-view';
import { CalendarView } from '@/components/projects/calendar-view';
import { TableView } from '@/components/projects/table-view';
import { CardDetailModal } from '@/components/projects/card-detail-modal';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import {
  Kanban,
  Calendar,
  Table,
  Plus,
  RefreshCw,
  ChevronDown,
  FolderKanban,
  Check,
  AlertCircle,
} from 'lucide-react';
import { ProjectCard, ProjectColumn, Project } from '@/lib/database-projects';
import { cn } from '@/lib/utils';

type ViewMode = 'board' | 'calendar' | 'table';

interface BoardColumn extends ProjectColumn {
  cards: ProjectCard[];
}

interface ProjectData {
  project: Project | null;
  columns: BoardColumn[];
}

interface ProjectStats {
  totalCards: number;
  completedCards: number;
  overdueCards: number;
  highPriorityCards: number;
  completionRate: number;
}

const DEFAULT_USER_ID = 'default-user';

export default function ProjectsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<ProjectCard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Fetch all projects
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects?user_id=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data.projects || []);

      if (!selectedProjectId && data.projects?.length > 0) {
        setSelectedProjectId(data.projects[0].id);
      }
    } catch (e: any) {
      console.error('Error fetching projects:', e);
    }
  }, [selectedProjectId]);

  // Fetch project board data
  const fetchProjectData = useCallback(async () => {
    if (!selectedProjectId) {
      setProjectData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [boardResponse, statsResponse] = await Promise.all([
        fetch(`/api/projects/${selectedProjectId}/board`),
        fetch(`/api/projects/${selectedProjectId}/stats`),
      ]);

      if (!boardResponse.ok) throw new Error('Failed to fetch project data');

      const boardData = await boardResponse.json();
      const statsData = statsResponse.ok ? await statsResponse.json() : null;

      setProjectData(boardData);
      setStats(statsData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Create new project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: DEFAULT_USER_ID,
          name: newProjectName.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to create project');

      const { project } = await response.json();
      setProjects((prev) => [project, ...prev]);
      setSelectedProjectId(project.id);
      setNewProjectName('');
      setCreatingProject(false);
    } catch (e: any) {
      console.error('Error creating project:', e);
    }
  };

  // Card/Column handlers
  const handleAddCard = async (columnId: string, title: string, dueDate?: string) => {
    if (!selectedProjectId) return;
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column_id: columnId,
          title,
          due_date: dueDate,
          position: projectData?.columns.find((c) => c.id === columnId)?.cards.length || 0,
        }),
      });
      if (!response.ok) throw new Error('Failed to create card');
      await fetchProjectData();
    } catch (e: any) {
      console.error('Error creating card:', e);
    }
  };

  const handleUpdateCard = async (cardId: string, updates: Partial<ProjectCard>) => {
    try {
      const response = await fetch(`/api/projects/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update card');
      await fetchProjectData();
    } catch (e: any) {
      console.error('Error updating card:', e);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const response = await fetch(`/api/projects/cards/${cardId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete card');
      await fetchProjectData();
    } catch (e: any) {
      console.error('Error deleting card:', e);
    }
  };

  const handleMoveCard = async (cardId: string, targetColumnId: string, position: number) => {
    try {
      const response = await fetch(`/api/projects/cards/${cardId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: targetColumnId, position }),
      });
      if (!response.ok) throw new Error('Failed to move card');
      await fetchProjectData();
    } catch (e: any) {
      console.error('Error moving card:', e);
    }
  };

  const handleAddColumn = async (name: string) => {
    if (!selectedProjectId) return;
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, position: projectData?.columns.length || 0 }),
      });
      if (!response.ok) throw new Error('Failed to create column');
      await fetchProjectData();
    } catch (e: any) {
      console.error('Error creating column:', e);
    }
  };

  const handleUpdateColumn = async (columnId: string, updates: Partial<ProjectColumn>) => {
    try {
      const response = await fetch(`/api/projects/columns/${columnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update column');
      await fetchProjectData();
    } catch (e: any) {
      console.error('Error updating column:', e);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm('Are you sure? This will delete all cards in this column.')) return;
    try {
      const response = await fetch(`/api/projects/columns/${columnId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete column');
      await fetchProjectData();
    } catch (e: any) {
      console.error('Error deleting column:', e);
    }
  };

  const handleCardClick = (card: ProjectCard) => {
    setSelectedCard(card);
    setIsModalOpen(true);
  };

  const allCards = projectData?.columns.flatMap((col) => col.cards) || [];

  if (loading && !projectData) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="max-w-6xl mx-auto">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64 mb-8" />
            <div className="flex gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-80 flex-shrink-0">
                  <Skeleton className="h-10 w-full mb-4 rounded-xl" />
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderKanban className="w-6 h-6 text-primary" />
              </div>
              <div>
                {/* Project Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowProjectMenu(!showProjectMenu)}
                    className="flex items-center gap-2 text-title-lg hover:text-primary transition-colors"
                  >
                    {projectData?.project?.name || 'Select Project'}
                    <ChevronDown className={cn('w-5 h-5 transition-transform', showProjectMenu && 'rotate-180')} />
                  </button>

                  {/* Dropdown */}
                  {showProjectMenu && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                      <div className="p-2 border-b border-border">
                        {creatingProject ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newProjectName}
                              onChange={(e) => setNewProjectName(e.target.value)}
                              className="flex-1 bg-background border border-border px-3 py-2 rounded-md text-sm"
                              placeholder="Project name..."
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateProject();
                                if (e.key === 'Escape') setCreatingProject(false);
                              }}
                            />
                            <Button size="sm" onClick={handleCreateProject}>Add</Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCreatingProject(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            New Project
                          </button>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1">
                        {projects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => {
                              setSelectedProjectId(project.id!);
                              setShowProjectMenu(false);
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between',
                              selectedProjectId === project.id && 'bg-primary/10 text-primary'
                            )}
                          >
                            {project.name}
                            {selectedProjectId === project.id && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                        {projects.length === 0 && (
                          <div className="px-3 py-6 text-center text-muted-foreground text-sm">
                            No projects yet
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {projectData?.project?.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {projectData.project.description}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Stats */}
              {stats && (
                <div className="flex items-center gap-4 mr-2 pr-4 border-r border-border">
                  <div className="text-center">
                    <div className="text-lg font-semibold tabular-nums">{stats.totalCards}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold tabular-nums text-success">{stats.completedCards}</div>
                    <div className="text-xs text-muted-foreground">Done</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold tabular-nums text-primary">{stats.completionRate}%</div>
                    <div className="text-xs text-muted-foreground">Complete</div>
                  </div>
                </div>
              )}

              {/* Refresh */}
              <Button variant="outline" size="icon" onClick={fetchProjectData} title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>

              {/* View Toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('board')}
                  className={cn(
                    'p-2 transition-colors',
                    viewMode === 'board' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                  title="Board View"
                >
                  <Kanban className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={cn(
                    'p-2 transition-colors border-l border-border',
                    viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                  title="Calendar View"
                >
                  <Calendar className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'p-2 transition-colors border-l border-border',
                    viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                  title="Table View"
                >
                  <Table className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* No Project Selected */}
          {!selectedProjectId && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FolderKanban className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Project Selected</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-md">
                Create a new project or select an existing one to get started with your tasks.
              </p>
              <Button
                onClick={() => {
                  setShowProjectMenu(true);
                  setCreatingProject(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>
          )}

          {/* Views */}
          {selectedProjectId && projectData && (
            <div className="animate-fade-in">
              {viewMode === 'board' && (
                <BoardView
                  columns={projectData.columns}
                  onAddCard={handleAddCard}
                  onUpdateCard={handleUpdateCard}
                  onDeleteCard={handleDeleteCard}
                  onMoveCard={handleMoveCard}
                  onAddColumn={handleAddColumn}
                  onUpdateColumn={handleUpdateColumn}
                  onDeleteColumn={handleDeleteColumn}
                  onCardClick={handleCardClick}
                />
              )}

              {viewMode === 'calendar' && (
                <CalendarView
                  cards={allCards}
                  columns={projectData.columns}
                  onCardClick={handleCardClick}
                  onAddCard={handleAddCard}
                  onUpdateCard={handleUpdateCard}
                />
              )}

              {viewMode === 'table' && (
                <TableView
                  cards={allCards}
                  columns={projectData.columns}
                  onCardClick={handleCardClick}
                  onUpdateCard={handleUpdateCard}
                  onDeleteCard={handleDeleteCard}
                />
              )}
            </div>
          )}

          {/* Card Detail Modal */}
          <CardDetailModal
            card={selectedCard}
            columns={projectData?.columns || []}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedCard(null);
            }}
            onUpdate={handleUpdateCard}
            onDelete={handleDeleteCard}
          />
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {showProjectMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowProjectMenu(false)} />
      )}
    </DashboardLayout>
  );
}
