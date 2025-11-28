# UI/UX Audit Report - Task Manager Module

## 1. Recurring Tasks (Agent Automation)
**Location:** `/agents/tasks`

### Findings:
- **Empty State:** The page is essentially blank except for navigation and a "Quick Actions" card.
- **Missing Data:** Despite having populated agents, no recurring tasks are visible in the list.
    - *Root Cause:* The migration script populated `agent_configs` but didn't add default `recurring_tasks`. The `start-all-bots.sh` script starts the backend which *should* register tasks, but the dashboard might be querying tasks before they are registered or the registration logic hasn't run yet.
- **Layout:** "Quick Actions" takes up significant space without offering much value if there are no tasks.
- **Navigation:** "Back to Agents" is good, but breadcrumbs would be better.

### Recommendations:
1.  **Populate Default Tasks:** Update the `populate-agents.ts` or backend startup logic to ensure default tasks (e.g., "Daily Market Update", "Morning Briefing") are inserted into the `recurring_tasks` table immediately.
2.  **Better Empty State:** Show an illustration or "Create your first task" button when the list is empty.
3.  **Status Indicators:** When tasks exist, show "Next Run" time clearly with a countdown (e.g., "in 2 hours").

## 2. Project Management (Kanban)
**Location:** `/projects`

### Findings:
- **Visual Style:** The Kanban board uses a very stark, wireframe-like aesthetic (white background, black borders). It looks functional but unpolished compared to the rest of the dashboard.
- **Card Density:** The cards ("transaction log") are very tall with a lot of whitespace.
- **Columns:** "BACKLOG (2)", "TODO (0)", etc. Headers are clean.
- **Interactivity:** The "+ ADD CARD" button is prominent.
- **Project Title:** "MAMA" is displayed. It's unclear if this is a default project or user-created.

### Recommendations:
1.  **Card Styling:** Add a subtle background color or shadow to cards to make them pop off the board. Reduce padding to fit more content.
2.  **Drag & Drop:** (Needs functional testing) Ensure cards can be dragged between columns smoothly.
3.  **Tags/Labels:** Add support for colored tags (e.g., "High Priority", "Bug") to make the board scannable.
4.  **Assignees:** Show avatar of the assigned agent/user on the card.

## Summary
The "Recurring Tasks" module is currently empty and needs data population to be useful. The "Project Management" module works but feels like a low-fidelity wireframe. Both need polish to match the quality of the "Finance" dashboard.


