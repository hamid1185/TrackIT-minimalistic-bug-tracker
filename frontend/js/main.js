// BugSage - Unified JavaScript utilities
const API_BASE = '/bugsagev3/backend/api/';

// Core API handler
const api = {
    async request(endpoint, options = {}) {
        const url = API_BASE + endpoint;
        const settings = {
            credentials: 'same-origin',
            headers: options.headers || {},
            ...options,
        };
        
        if (settings.body instanceof FormData) {
            delete settings.headers['Content-Type'];
        } else if (!settings.headers['Content-Type']) {
            settings.headers['Content-Type'] = 'application/json';
        }
        
        const response = await fetch(url, settings);
        const isJson = response.headers.get("content-type")?.includes("application/json");
        
        if (isJson) {
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Error: ${response.status}`);
            return data;
        }
        throw new Error("Server did not return JSON");
    }
};

// UI utilities
const ui = {
    showToast(message, type = 'info') {
        this.addToastStyles();
        const toast = document.createElement('div');
        const colors = { error: '#ef4444', success: '#10b981', warning: '#f59e0b', info: '#3b82f6' };
        toast.style.cssText = `position:fixed;top:20px;right:20px;padding:12px 16px;background:${colors[type] || colors.info};color:#fff;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:10000;max-width:300px;font-size:14px;animation:slideIn .3s ease-out;`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut .3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    
    addToastStyles() {
        if (!document.querySelector('#toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `@keyframes slideIn{from{transform:translateX(100%);opacity:0;}to{transform:translateX(0);opacity:1;}}@keyframes slideOut{from{transform:translateX(0);opacity:1;}to{transform:translateX(100%);opacity:0;}}`;
            document.head.appendChild(style);
        }
    },
    
    showError(message, id = 'error-message') { this._showMessage(message, id, 'error', 5000); },
    showSuccess(message, id = 'success-message') { this._showMessage(message, id, 'success', 3000); },
    
    _showMessage(message, id, type, timeout) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', timeout);
        }
        this.showToast(message, type);
    },
    
    setLoading(id, loading = true) {
        const el = document.getElementById(id);
        if (el && loading) el.innerHTML = '<div class="loading">Loading...</div>';
    }
};

// Formatting utilities
const format = {
    date(str) {
        if (!str) return 'N/A';
        const d = new Date(str);
        return d.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    },
    
    text(txt, max = 100) {
        if (!txt) return 'N/A';
        if (txt.length <= max) return this.escapeHtml(txt);
        return this.escapeHtml(txt.substring(0, max)) + '...';
    },
    
    escapeHtml(txt) {
        const div = document.createElement('div');
        div.textContent = txt || '';
        return div.innerHTML;
    },
    
    fileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }
};

// CSS utilities
const css = {
    getPriorityClass(priority) {
        const map = { Low: 'priority-low', Medium: 'priority-medium', High: 'priority-high', Critical: 'priority-critical' };
        return map[priority] || map.Medium;
    },
    
    getStatusClass(status) {
        const map = { New: 'status-new', 'In Progress': 'status-progress', Resolved: 'status-resolved', Closed: 'status-closed' };
        return map[status] || map.New;
    }
};

// Authentication
const auth = {
    async check() {
        try {
            const result = await api.request('auth.php?action=check');
            if (result.authenticated) {
                this.updateUserInfo(result.user);
                return result.user;
            }
            if (!this.isAuthPage()) window.location.href = 'login.html';
            return null;
        } catch {
            if (!this.isAuthPage()) window.location.href = 'login.html';
            return null;
        }
    },
    
    isAuthPage() {
        const path = window.location.pathname.toLowerCase();
        return ['login.html', 'registration.html', 'index.html'].some(page => path.includes(page)) || path.endsWith('/');
    },
    
    updateUserInfo(user) {
        document.querySelectorAll('#user-name,#welcome-name').forEach(e => e.textContent = user.name);
        if (user.role === 'Admin') this.showAdminFeatures();
    },
    
    showAdminFeatures() {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        const nav = document.querySelector('.nav-menu');
        if (nav && !document.querySelector('a[href="admin.html"]')) {
            nav.insertAdjacentHTML('beforeend', `<a href="admin.html" class="nav-link admin-only"><i class="fas fa-cog"></i> Admin</a>`);
        }
    },
    
    async logout() {
        try {
            await api.request('auth.php?action=logout', { method: 'POST' });
            ui.showSuccess('Logged out successfully');
            setTimeout(() => window.location.href = 'login.html', 1000);
        } catch {
            window.location.href = 'login.html';
        }
    }
};

// Bug management
const bugs = {
    currentFilters: {},
    currentPage: 1,
    
    async loadList(page = 1, filters = {}) {
        this.currentPage = page;
        this.currentFilters = { ...filters };
        const tbody = document.querySelector('#bugs-table tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="loading">Loading bugs...</td></tr>`;
        
        try {
            const params = new URLSearchParams({ page, ...filters });
            const result = await api.request(`bugs.php?action=list&${params}`);
            if (result.bugs) {
                this.displayList(result.bugs);
                if (result.pagination) this.displayPagination(result.pagination);
            } else {
                throw new Error('Missing bugs array');
            }
        } catch (e) {
            ui.showError('Failed to load bugs: ' + e.message);
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500">Failed to load bugs: ${e.message}</td></tr>`;
        }
    },
    
    displayList(list) {
        const tbody = document.querySelector('#bugs-table tbody');
        if (!tbody) return;
        
        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center">No bugs found</td></tr>`;
            return;
        }
        
        tbody.innerHTML = list.map(bug => `
            <tr>
                <td>#${bug.bug_id}</td>
                <td><a href="bugdetail.html?id=${bug.bug_id}" class="font-medium text-blue-600 hover:text-blue-800">${format.text(bug.title, 60)}</a></td>
                <td class="hidden-mobile"><span class="badge ${css.getPriorityClass(bug.priority)}">${bug.priority}</span></td>
                <td class="hidden-mobile"><span class="badge ${css.getStatusClass(bug.status)}">${bug.status}</span></td>
                <td class="hidden-tablet">${bug.assignee_name || 'Unassigned'}</td>
                <td class="hidden-desktop">${format.date(bug.created_at).split(',')[0]}</td>
                <td><a href="bugdetail.html?id=${bug.bug_id}" class="btn btn-sm btn-primary">View</a></td>
            </tr>
        `).join('');
    },
    
    displayPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!container) return;
        
        const { current_page, total_pages, total_bugs } = pagination;
        if (total_pages <= 1) {
            container.innerHTML = `<div class="pagination-info">Showing ${total_bugs} bug${total_bugs !== 1 ? 's' : ''}</div>`;
            return;
        }
        
        let html = `<div class="pagination-controls">`;
        html += `<button class="btn btn-sm${current_page <= 1 ? ' disabled' : ''}" ${current_page > 1 ? `onclick="bugs.loadList(${current_page - 1}, bugs.currentFilters)"` : 'disabled'}>Previous</button>`;
        
        const start = Math.max(1, current_page - 2);
        const end = Math.min(total_pages, current_page + 2);
        
        if (start > 1) {
            html += `<button class="btn btn-sm" onclick="bugs.loadList(1, bugs.currentFilters)">1</button>`;
            if (start > 2) html += '<span class="pagination-ellipsis">...</span>';
        }
        
        for (let i = start; i <= end; i++) {
            html += `<button class="btn btn-sm${i === current_page ? ' active' : ''}" onclick="bugs.loadList(${i}, bugs.currentFilters)">${i}</button>`;
        }
        
        if (end < total_pages) {
            if (end < total_pages - 1) html += '<span class="pagination-ellipsis">...</span>';
            html += `<button class="btn btn-sm" onclick="bugs.loadList(${total_pages}, bugs.currentFilters)">${total_pages}</button>`;
        }
        
        html += `<button class="btn btn-sm${current_page >= total_pages ? ' disabled' : ''}" ${current_page < total_pages ? `onclick="bugs.loadList(${current_page + 1}, bugs.currentFilters)"` : 'disabled'}>Next</button>`;
        html += `</div><div class="pagination-info">Page ${current_page} of ${total_pages} (${total_bugs} bugs)</div>`;
        container.innerHTML = html;
    },
    
    async loadDetails(bugId) {
        if (!bugId) return ui.showError('Invalid bug ID');
        ui.setLoading('bug-title', true);
        
        try {
            const result = await api.request(`bugs.php?action=details&id=${bugId}`);
            this.displayDetails(result.bug);
            this.displayComments(result.comments);
            this.displayAttachments(result.attachments);
        } catch (e) {
            ui.showError('Failed to load bug details: ' + e.message);
        }
    },
    
    displayDetails(bug) {
        const fields = {
            'bug-title': `#${bug.bug_id}: ${bug.title}`,
            'bug-id': bug.bug_id,
            'bug-status': bug.status,
            'bug-priority': bug.priority,
            'bug-reporter': bug.reporter_name || 'Unknown',
            'bug-assignee': bug.assignee_name || 'Unassigned',
            'bug-created': format.date(bug.created_at),
            'bug-description-content': bug.description
        };
        
        for (const id in fields) {
            const el = document.getElementById(id);
            if (el) el.textContent = fields[id];
        }
        
        const statusEl = document.getElementById('bug-status');
        if (statusEl) statusEl.className = 'badge ' + css.getStatusClass(bug.status);
        
        const priorityEl = document.getElementById('bug-priority');
        if (priorityEl) priorityEl.className = 'badge ' + css.getPriorityClass(bug.priority);
        
        document.title = `Bug #${bug.bug_id}: ${bug.title} - BugSage`;
    },
    
    displayComments(comments) {
        const container = document.getElementById('comments-list');
        if (!container) return;
        
        if (!comments.length) {
            container.innerHTML = `<div class="text-center text-gray-500 py-4">No comments yet</div>`;
            return;
        }
        
        container.innerHTML = comments.map(comment => `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author"><i class="fas fa-user-circle"></i> ${format.escapeHtml(comment.user_name)}</span>
                    <span class="comment-date">${format.date(comment.created_at)}</span>
                </div>
                <div class="comment-text">${format.escapeHtml(comment.comment_text)}</div>
            </div>
        `).join('');
    },
    
    displayAttachments(attachments) {
        const container = document.getElementById('attachments-list');
        if (!container) return;
        
        if (!attachments.length) {
            container.innerHTML = `<div class="text-center text-gray-500 py-4">No attachments</div>`;
            return;
        }
        
        container.innerHTML = attachments.map(a => `
            <div class="attachment-item">
                <a href="${a.file_path}" target="_blank" class="text-blue-600 hover:text-blue-800">
                    <i class="fas fa-paperclip"></i> ${format.escapeHtml(a.original_name)}
                    <small class="text-gray-500">(${format.fileSize(a.file_size)})</small>
                </a>
            </div>
        `).join('');
    },
    
    async updateStatus(bugId, newStatus) {
        if (!bugId || !newStatus) return ui.showError('Invalid bug ID or status');
        
        try {
            const fd = new FormData();
            fd.append('bug_id', bugId);
            fd.append('status', newStatus);
            await api.request('updatebugstatus.php', { method: 'POST', body: fd });
            ui.showSuccess(`Status updated to ${newStatus}`);
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            ui.showError('Failed to update status: ' + e.message);
        }
    },
    
    async submitComment(bugId, commentText) {
        if (!bugId || !commentText.trim()) return ui.showError('Comment text is required');
        
        try {
            const fd = new FormData();
            fd.append('bug_id', bugId);
            fd.append('comment', commentText.trim());
            await api.request('bugs.php?action=comment', { method: 'POST', body: fd });
            ui.showSuccess('Comment added successfully');
            const ta = document.getElementById('comment-text');
            if (ta) ta.value = '';
            setTimeout(() => this.loadDetails(bugId), 1000);
        } catch (e) {
            ui.showError('Failed to add comment: ' + e.message);
        }
    }
};

// Filters
const filters = {
    setup() {
        const applyBtn = document.getElementById('apply-filters');
        const clearBtn = document.getElementById('clear-filters');
        if (applyBtn) applyBtn.addEventListener('click', () => this.apply());
        if (clearBtn) clearBtn.addEventListener('click', () => this.clear());
        
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') this.apply();
        });
    },
    
    apply() {
        const filterValues = {};
        ['status-filter', 'priority-filter', 'search-input'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value) {
                const key = id.replace('-filter', '').replace('-input', '');
                filterValues[key] = el.value.trim();
            }
        });
        bugs.loadList(1, filterValues);
    },
    
    clear() {
        ['status-filter', 'priority-filter', 'search-input'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        bugs.loadList(1, {});
    }
};

// DOM event handlers
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', e => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) auth.logout();
    });
    
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const bugId = new URLSearchParams(window.location.search).get('id');
            const newStatus = btn.dataset.status;
            if (bugId && newStatus && confirm(`Change status to ${newStatus}?`)) {
                bugs.updateStatus(bugId, newStatus);
            }
        });
    });
    
    const commentForm = document.getElementById('comment-form');
    if (commentForm) commentForm.addEventListener('submit', async e => {
        e.preventDefault();
        const bugId = new URLSearchParams(window.location.search).get('id');
        const commentText = document.getElementById('comment-text')?.value?.trim();
        if (!commentText) return ui.showError('Please enter a comment');
        if (bugId) await bugs.submitComment(bugId, commentText);
    });
});

// Global exports
window.api = api;
window.ui = ui;
window.format = format;
window.css = css;
window.auth = auth;
window.bugs = bugs;
window.filters = filters;