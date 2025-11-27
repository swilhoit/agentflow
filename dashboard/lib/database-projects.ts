import { query } from './postgres';

// Types for Project Management
export interface Project {
  id?: string;
  user_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectColumn {
  id?: string;
  project_id: string;
  name: string;
  position: number;
  color?: string;
  created_at?: string;
}

export interface ProjectCard {
  id?: string;
  column_id: string;
  project_id: string;
  title: string;
  description?: string;
  position: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  labels?: string[];
  assignee?: string;
  estimated_hours?: number;
  actual_hours?: number;
  is_completed?: boolean;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectLabel {
  id?: string;
  project_id: string;
  name: string;
  color: string;
}

// Default columns for new projects
export const DEFAULT_COLUMNS = [
  { name: 'BACKLOG', color: '#6b7280' },
  { name: 'TODO', color: '#f59e0b' },
  { name: 'IN PROGRESS', color: '#3b82f6' },
  { name: 'REVIEW', color: '#8b5cf6' },
  { name: 'DONE', color: '#10b981' },
];

// Query functions for Project Management using Hetzner PostgreSQL
export const db_queries_projects = {
  // Projects
  getAllProjects: async (userId: string): Promise<Project[]> => {
    try {
      const result = await query(
        `SELECT * FROM projects
         WHERE user_id = $1 AND is_archived = false
         ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows || [];
    } catch (e) {
      console.warn('Projects table may not exist:', e);
      return [];
    }
  },

  getProject: async (projectId: string): Promise<Project | null> => {
    try {
      const result = await query(
        `SELECT * FROM projects WHERE id = $1`,
        [projectId]
      );
      return result.rows?.[0] || null;
    } catch (e) {
      return null;
    }
  },

  createProject: async (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> => {
    try {
      const result = await query(
        `INSERT INTO projects (user_id, name, description, color, icon, is_archived)
         VALUES ($1, $2, $3, $4, $5, false)
         RETURNING *`,
        [project.user_id, project.name, project.description, project.color || '#3b82f6', project.icon]
      );

      const newProject = result.rows[0];

      // Create default columns for the new project
      if (newProject) {
        for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
          await query(
            `INSERT INTO project_columns (project_id, name, color, position)
             VALUES ($1, $2, $3, $4)`,
            [newProject.id, DEFAULT_COLUMNS[i].name, DEFAULT_COLUMNS[i].color, i]
          );
        }
      }

      return newProject;
    } catch (e) {
      console.error('Error creating project:', e);
      throw e;
    }
  },

  updateProject: async (projectId: string, updates: Partial<Project>): Promise<Project> => {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.color !== undefined) {
        setClauses.push(`color = $${paramIndex++}`);
        values.push(updates.color);
      }
      if (updates.icon !== undefined) {
        setClauses.push(`icon = $${paramIndex++}`);
        values.push(updates.icon);
      }
      if (updates.is_archived !== undefined) {
        setClauses.push(`is_archived = $${paramIndex++}`);
        values.push(updates.is_archived);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(projectId);

      const result = await query(
        `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (e) {
      console.error('Error updating project:', e);
      throw e;
    }
  },

  deleteProject: async (projectId: string): Promise<boolean> => {
    try {
      await query(
        `UPDATE projects SET is_archived = true, updated_at = NOW() WHERE id = $1`,
        [projectId]
      );
      return true;
    } catch (e) {
      console.error('Error deleting project:', e);
      throw e;
    }
  },

  // Columns
  getProjectColumns: async (projectId: string): Promise<ProjectColumn[]> => {
    try {
      const result = await query(
        `SELECT * FROM project_columns
         WHERE project_id = $1
         ORDER BY position ASC`,
        [projectId]
      );
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  createColumn: async (column: Omit<ProjectColumn, 'id' | 'created_at'>): Promise<ProjectColumn> => {
    try {
      const result = await query(
        `INSERT INTO project_columns (project_id, name, position, color)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [column.project_id, column.name, column.position, column.color]
      );
      return result.rows[0];
    } catch (e) {
      console.error('Error creating column:', e);
      throw e;
    }
  },

  updateColumn: async (columnId: string, updates: Partial<ProjectColumn>): Promise<ProjectColumn> => {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.position !== undefined) {
        setClauses.push(`position = $${paramIndex++}`);
        values.push(updates.position);
      }
      if (updates.color !== undefined) {
        setClauses.push(`color = $${paramIndex++}`);
        values.push(updates.color);
      }

      values.push(columnId);

      const result = await query(
        `UPDATE project_columns SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (e) {
      console.error('Error updating column:', e);
      throw e;
    }
  },

  deleteColumn: async (columnId: string): Promise<boolean> => {
    try {
      await query(`DELETE FROM project_columns WHERE id = $1`, [columnId]);
      return true;
    } catch (e) {
      console.error('Error deleting column:', e);
      throw e;
    }
  },

  // Cards
  getProjectCards: async (projectId: string): Promise<ProjectCard[]> => {
    try {
      const result = await query(
        `SELECT * FROM project_cards
         WHERE project_id = $1
         ORDER BY position ASC`,
        [projectId]
      );
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  getColumnCards: async (columnId: string): Promise<ProjectCard[]> => {
    try {
      const result = await query(
        `SELECT * FROM project_cards
         WHERE column_id = $1
         ORDER BY position ASC`,
        [columnId]
      );
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  getCard: async (cardId: string): Promise<ProjectCard | null> => {
    try {
      const result = await query(
        `SELECT * FROM project_cards WHERE id = $1`,
        [cardId]
      );
      return result.rows?.[0] || null;
    } catch (e) {
      return null;
    }
  },

  createCard: async (card: Omit<ProjectCard, 'id' | 'created_at' | 'updated_at'>): Promise<ProjectCard> => {
    try {
      const result = await query(
        `INSERT INTO project_cards
         (column_id, project_id, title, description, position, priority, due_date, labels, assignee, estimated_hours, actual_hours, is_completed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
         RETURNING *`,
        [
          card.column_id,
          card.project_id,
          card.title,
          card.description,
          card.position,
          card.priority,
          card.due_date,
          card.labels || [],
          card.assignee,
          card.estimated_hours,
          card.actual_hours,
        ]
      );
      return result.rows[0];
    } catch (e) {
      console.error('Error creating card:', e);
      throw e;
    }
  },

  updateCard: async (cardId: string, updates: Partial<ProjectCard>): Promise<ProjectCard> => {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.column_id !== undefined) {
        setClauses.push(`column_id = $${paramIndex++}`);
        values.push(updates.column_id);
      }
      if (updates.title !== undefined) {
        setClauses.push(`title = $${paramIndex++}`);
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.position !== undefined) {
        setClauses.push(`position = $${paramIndex++}`);
        values.push(updates.position);
      }
      if (updates.priority !== undefined) {
        setClauses.push(`priority = $${paramIndex++}`);
        values.push(updates.priority);
      }
      if (updates.due_date !== undefined) {
        setClauses.push(`due_date = $${paramIndex++}`);
        values.push(updates.due_date);
      }
      if (updates.labels !== undefined) {
        setClauses.push(`labels = $${paramIndex++}`);
        values.push(updates.labels);
      }
      if (updates.assignee !== undefined) {
        setClauses.push(`assignee = $${paramIndex++}`);
        values.push(updates.assignee);
      }
      if (updates.estimated_hours !== undefined) {
        setClauses.push(`estimated_hours = $${paramIndex++}`);
        values.push(updates.estimated_hours);
      }
      if (updates.actual_hours !== undefined) {
        setClauses.push(`actual_hours = $${paramIndex++}`);
        values.push(updates.actual_hours);
      }
      if (updates.is_completed !== undefined) {
        setClauses.push(`is_completed = $${paramIndex++}`);
        values.push(updates.is_completed);
        if (updates.is_completed) {
          setClauses.push(`completed_at = NOW()`);
        } else {
          setClauses.push(`completed_at = NULL`);
        }
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(cardId);

      const result = await query(
        `UPDATE project_cards SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (e) {
      console.error('Error updating card:', e);
      throw e;
    }
  },

  deleteCard: async (cardId: string): Promise<boolean> => {
    try {
      await query(`DELETE FROM project_cards WHERE id = $1`, [cardId]);
      return true;
    } catch (e) {
      console.error('Error deleting card:', e);
      throw e;
    }
  },

  moveCard: async (cardId: string, targetColumnId: string, newPosition: number): Promise<ProjectCard> => {
    try {
      const result = await query(
        `UPDATE project_cards
         SET column_id = $1, position = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [targetColumnId, newPosition, cardId]
      );
      return result.rows[0];
    } catch (e) {
      console.error('Error moving card:', e);
      throw e;
    }
  },

  // Get cards with due dates for calendar view
  getCardsWithDueDates: async (projectId: string, startDate?: string, endDate?: string): Promise<ProjectCard[]> => {
    try {
      let sql = `SELECT * FROM project_cards WHERE project_id = $1 AND due_date IS NOT NULL`;
      const params: any[] = [projectId];

      if (startDate) {
        params.push(startDate);
        sql += ` AND due_date >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        sql += ` AND due_date <= $${params.length}`;
      }

      sql += ` ORDER BY due_date ASC`;

      const result = await query(sql, params);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get overdue cards
  getOverdueCards: async (projectId: string): Promise<ProjectCard[]> => {
    try {
      const result = await query(
        `SELECT * FROM project_cards
         WHERE project_id = $1
           AND is_completed = false
           AND due_date < CURRENT_DATE
         ORDER BY due_date ASC`,
        [projectId]
      );
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Project Statistics
  getProjectStats: async (projectId: string) => {
    try {
      const result = await query(
        `SELECT
           COUNT(*) as total_cards,
           COUNT(*) FILTER (WHERE is_completed = true) as completed_cards,
           COUNT(*) FILTER (WHERE is_completed = false AND due_date < CURRENT_DATE) as overdue_cards,
           COUNT(*) FILTER (WHERE priority IN ('high', 'urgent')) as high_priority_cards,
           COALESCE(SUM(estimated_hours), 0) as total_estimated_hours,
           COALESCE(SUM(actual_hours), 0) as total_actual_hours
         FROM project_cards
         WHERE project_id = $1`,
        [projectId]
      );

      const row = result.rows[0];
      const total = parseInt(row.total_cards) || 0;
      const completed = parseInt(row.completed_cards) || 0;

      return {
        totalCards: total,
        completedCards: completed,
        overdueCards: parseInt(row.overdue_cards) || 0,
        highPriorityCards: parseInt(row.high_priority_cards) || 0,
        totalEstimatedHours: parseFloat(row.total_estimated_hours) || 0,
        totalActualHours: parseFloat(row.total_actual_hours) || 0,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    } catch (e) {
      return {
        totalCards: 0,
        completedCards: 0,
        overdueCards: 0,
        highPriorityCards: 0,
        totalEstimatedHours: 0,
        totalActualHours: 0,
        completionRate: 0,
      };
    }
  },

  // Get full board data (project + columns + cards)
  getFullBoard: async (projectId: string) => {
    try {
      const [project, columns, cards] = await Promise.all([
        db_queries_projects.getProject(projectId),
        db_queries_projects.getProjectColumns(projectId),
        db_queries_projects.getProjectCards(projectId),
      ]);

      // Group cards by column
      const cardsByColumn = columns.map((column) => ({
        ...column,
        cards: cards.filter((card) => card.column_id === column.id),
      }));

      return {
        project,
        columns: cardsByColumn,
      };
    } catch (e) {
      console.error('Error getting full board:', e);
      return null;
    }
  },

  // Labels
  getProjectLabels: async (projectId: string): Promise<ProjectLabel[]> => {
    try {
      const result = await query(
        `SELECT * FROM project_labels WHERE project_id = $1 ORDER BY name`,
        [projectId]
      );
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  createLabel: async (label: Omit<ProjectLabel, 'id'>): Promise<ProjectLabel> => {
    try {
      const result = await query(
        `INSERT INTO project_labels (project_id, name, color) VALUES ($1, $2, $3) RETURNING *`,
        [label.project_id, label.name, label.color]
      );
      return result.rows[0];
    } catch (e) {
      console.error('Error creating label:', e);
      throw e;
    }
  },

  deleteLabel: async (labelId: string): Promise<boolean> => {
    try {
      await query(`DELETE FROM project_labels WHERE id = $1`, [labelId]);
      return true;
    } catch (e) {
      console.error('Error deleting label:', e);
      throw e;
    }
  },
};
