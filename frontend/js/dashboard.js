// Dashboard JavaScript - Simplified
const dashboardApi = {
    getStats: () => api.request('dashboard.php?action=stats'),
    getRecentBugs: () => api.request('dashboard.php?action=recent'),
    getMyBugs: () => api.request('bugs.php?action=list&assignee=me&per_page=5')
};

const dashboardUI = {
    displayStats(stats = {}) {
        ['total-bugs', 'my-bugs'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = stats[id.replace('-', '_')] || 0;
        });

        const activeCount = (stats.status_counts || []).reduce((sum, s) =>
            ['New', 'In Progress'].includes(s.status) ? sum + (+s.count || 0) : sum, 0);
        const criticalCount = (stats.priority_counts || []).find(p => p.priority === 'Critical')?.count || 0;

        ['active-bugs', 'critical-bugs'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.textContent = i ? criticalCount : activeCount;
        });

        if (stats.status_counts) this.displayStatusOverview(stats.status_counts);
    },

    displayStatusOverview(statusCounts = []) {
        const container = document.getElementById('status-overview');
        if (!container) return;
        
        const statuses = ['New', 'In Progress', 'Resolved', 'Closed'];
        const colors = ['new', 'progress', 'resolved', 'closed'];
        const map = Object.fromEntries(statuses.map((s, i) => [s, { color: colors[i], count: 0 }]));
        
        statusCounts.forEach(s => map[s.status] && (map[s.status].count = +s.count || 0));
        
        container.innerHTML = statuses.map(s => `
            <div class="status-item">
                <div class="status-item-label">
                    <div class="status-dot ${map[s].color}"></div>
                    <span>${s}</span>
                </div>
                <span class="font-medium">${map[s].count}</span>
            </div>
        `).join('');
    },

    displayRecentBugs(bugsList = []) {
        const tbody = document.querySelector('#recent-bugs-table tbody');
        if (!tbody) return;
        
        if (!bugsList.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500">No recent bugs</td></tr>';
            return;
        }
        
        tbody.innerHTML = bugsList.slice(0, 10).map(bug => `
            <tr>
                <td>
                    <a href="bugdetail.html?id=${bug.bug_id}" class="font-medium text-blue-600 hover:text-blue-800">
                        #${bug.bug_id}: ${format.text(bug.title?.substring(0, 40) || 'Untitled', 40)}${bug.title?.length > 40 ? '...' : ''}
                    </a>
                </td>
                <td class="hidden-mobile"><span class="badge ${css.getPriorityClass(bug.priority)}">${bug.priority || 'Medium'}</span></td>
                <td class="hidden-tablet"><span class="badge ${css.getStatusClass(bug.status)}">${bug.status || 'New'}</span></td>
                <td class="hidden-desktop">${format.date(bug.created_at)}</td>
            </tr>
        `).join('');
    },

    displayMyBugs(bugsList = []) {
        const container = document.getElementById('my-bugs-list');
        if (!container) return;
        
        if (!bugsList.length) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-check-circle text-3xl mb-2 text-green-400"></i>
                    <p>All caught up! No bugs assigned to you.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = bugsList.slice(0, 5).map(bug => `
            <div class="bug-item">
                <div class="bug-item-header">
                    <a href="bugdetail.html?id=${bug.bug_id}" class="bug-item-title">
                        #${bug.bug_id}: ${format.text(bug.title?.substring(0, 50) || 'Untitled', 50)}${bug.title?.length > 50 ? '...' : ''}
                    </a>
                    <div class="bug-item-badges">
                        <span class="badge ${css.getPriorityClass(bug.priority)}">${bug.priority || 'Medium'}</span>
                        <span class="badge ${css.getStatusClass(bug.status)}">${bug.status || 'New'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
};

const dashboard = {
    async init() {
        if (!await auth.check()) return;
        try {
            await Promise.all([this.loadStats(), this.loadRecentBugs(), this.loadMyBugs()]);
        } catch {
            ui.showError('Failed to load dashboard data');
        }
    },
    
    async loadStats() {
        try {
            dashboardUI.displayStats(await dashboardApi.getStats());
        } catch {
            ui.showError('Failed to load dashboard statistics');
            dashboardUI.displayStats();
        }
    },
    
    async loadRecentBugs() {
        try {
            const r = await dashboardApi.getRecentBugs();
            dashboardUI.displayRecentBugs(r.recent_bugs || r.bugs || []);
        } catch {
            const tbody = document.querySelector('#recent-bugs-table tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500">Failed to load recent bugs</td></tr>';
        }
    },
    
    async loadMyBugs() {
        try {
            const r = await dashboardApi.getMyBugs();
            dashboardUI.displayMyBugs(r.bugs || []);
        } catch {
            const c = document.getElementById('my-bugs-list');
            if (c) c.innerHTML = '<div class="text-center text-red-500">Failed to load assigned bugs</div>';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => dashboard.init());