'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BoardView } from '@/components/projects/board-view';
import { CalendarView } from '@/components/projects/calendar-view';
import { TableView } from '@/components/projects/table-view';
import { CardDetailModal } from '@/components/projects/card-detail-modal';
import {
  Kanban,
  Calendar,
  Table,
  Plus,
  Settings,
  RefreshCw,
  ChevronDown,
  FolderKanban,
  BarChart3,
} from 'lucide-react';
import { ProjectCard, ProjectColumn, Project } from '@/lib/database-projects';

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

      // Select first project if none selected
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

  // Add card
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

  // Update card
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

  // Delete card
  const handleDeleteCard = async (cardId: string) => {
    try {
      const response = await fetch(`/api/projects/cards/${cardId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete card');

      await fetchProjectData();
    } catch (e: any) {
      console.error('Error deleting card:', e);
    }
  };

  // Move card
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

  // Add column
  const handleAddColumn = async (name: string) => {
    if (!selectedProjectId) return;

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          position: projectData?.columns.length || 0,
        }),
      });

      if (!response.ok) throw new Error('Failed to create column');

      await fetchProjectData();
    } catch (e: any) {
      console.error('Error creating column:', e);
    }
  };

  // Update column
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

  // Delete column
  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm('Are you sure? This will delete all cards in this column.')) return;

    try {
      const response = await fetch(`/api/projects/columns/${columnId}`, {
        method: 'DELETE',
      });

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
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground font-mono flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              LOADING PROJECTS...
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <FolderKanban className="w-8 h-8" />
            <div>
              <div className="relative">
                <button
                  onClick={() => setShowProjectMenu(!showProjectMenu)}
                  className="flex items-center gap-2 text-2xl font-bold font-mono uppercase hover:text-accent"
                >
                  {projectData?.project?.name || 'SELECT PROJECT'}
                  <ChevronDown className="w-5 h-5" />
                </button>

                {/* Project Dropdown */}
                {showProjectMenu && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border shadow-lg z-50">
                    <div className="p-2 border-b border-border">
                      {creatingProject ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            className="flex-1 bg-background border border-border px-2 py-1 font-mono text-xs"
                            placeholder="Project name..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateProject();
                              if (e.key === 'Escape') setCreatingProject(false);
                            }}
                          />
                          <button
                            onClick={handleCreateProject}
                            className="px-2 py-1 bg-accent text-accent-foreground font-mono text-xs"
                          >
                            ADD
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCreatingProject(true)}
                          className="w-full flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase hover:bg-muted"
                        >
                          <Plus className="w-4 h-4" />
                          NEW PROJECT
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setSelectedProjectId(project.id!);
                            setShowProjectMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 font-mono text-sm hover:bg-muted ${
                            selectedProjectId === project.id ? 'bg-accent/10 text-accent' : ''
                          }`}
                        >
                          {project.name}
                        </button>
                      ))}
                      {projects.length === 0 && (
                        <div className="px-3 py-4 text-center text-muted-foreground font-mono text-xs">
                          No projects yet
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {projectData?.project?.description && (
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  {projectData.project.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Stats */}
            {stats && (
              <div className="flex items-center gap-4 mr-4">
                <div className="text-center">
                  <div className="text-lg font-bold font-mono">{stats.totalCards}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">TOTAL</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-green-500">
                    {stats.completedCards}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">DONE</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-accent">
                    {stats.completionRate}%
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">COMPLETE</div>
                </div>
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={fetchProjectData}
              className="p-2 border border-border hover:bg-muted transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* View Toggle */}
            <div className="flex border border-border">
              <button
                onClick={() => setViewMode('board')}
                className={`p-2 transition-colors ${
                  viewMode === 'board'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                }`}
                title="Board View"
              >
                <Kanban className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-2 transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                }`}
                title="Calendar View"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                }`}
                title="Table View"
              >
                <Table className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="border border-destructive bg-destructive/10 p-4 text-destructive font-mono text-sm">
            Error: {error}
          </div>
        )}

        {/* No Project Selected */}
        {!selectedProjectId && (
          <div className="border border-dashed border-border p-12 text-center">
            <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-mono text-lg uppercase mb-2">No Project Selected</h3>
            <p className="text-muted-foreground font-mono text-sm mb-4">
              Create a new project or select an existing one to get started
            </p>
            <button
              onClick={() => {
                setShowProjectMenu(true);
                setCreatingProject(true);
              }}
              className="px-4 py-2 bg-accent text-accent-foreground font-mono text-xs uppercase"
            >
              CREATE PROJECT
            </button>
          </div>
        )}

        {/* Views */}
        {selectedProjectId && projectData && (
          <>
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
          </>
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

      {/* Click outside to close dropdown */}
      {showProjectMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowProjectMenu(false)}
        />
      )}
    </DashboardLayout>
  );
}
