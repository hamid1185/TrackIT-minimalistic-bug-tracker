
const adminApi = {
    getProjects: () => api.request("projects.php?action=list"),
    createProject: formData => api.request("projects.php?action=create", { method: "POST", body: formData })
};

const adminUI = {
    displayProjects(projects) {
        const c = document.getElementById("projects-list");
        if (!c) return;
        c.innerHTML = projects.length === 0
            ? '<div class="text-center text-gray-500">No projects found</div>'
            : projects.map(p => `
                <div class="project-item">
                    <div class="project-header">
                        <h4 class="project-title">${format.escapeHtml(p.name)}</h4>
                        <div class="admin-item-actions">
                            <button class="btn btn-sm btn-secondary" onclick="admin.editProject(${p.project_id})">
                                <i class="fas fa-edit"></i>Edit
                            </button>
                        </div>
                    </div>
                    ${p.description ? `<div class="project-description">${format.escapeHtml(p.description)}</div>` : ""}
                    <div class="project-stats">
                        <div class="project-stat"><i class="fas fa-bug"></i><span>${p.bug_count || 0} bugs</span></div>
                        <div class="project-stat"><i class="fas fa-calendar"></i><span>Created ${format.date(p.created_at)}</span></div>
                    </div>
                </div>
            `).join("");
    },
    displayUsers(users) {
        const c = document.getElementById("users-list");
        if (!c) return;
        c.innerHTML = users.length === 0
            ? '<div class="text-center text-gray-500">No users found</div>'
            : users.map(u => `
                <div class="user-item">
                    <div class="user-info">
                        <h4>${format.escapeHtml(u.name)}</h4>
                        <div class="user-email">${format.escapeHtml(u.email)}</div>
                    </div>
                    <div class="user-role ${u.role.toLowerCase()}">${u.role}</div>
                    <div class="user-actions">
                        <button class="btn btn-sm btn-secondary" onclick="admin.editUser(${u.user_id})">
                            <i class="fas fa-edit"></i>Edit
                        </button>
                    </div>
                </div>
            `).join("");
    },
    showProjectModal() {
        const m = document.getElementById("project-modal");
        if (m) {
            m.style.display = "flex";
            ["project-name", "project-description"].forEach(id => document.getElementById(id).value = "");
        }
    },
    closeModal() {
        document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
    }
};

const admin = {
    async init() {
        const user = await auth.check();
        if (!user || user.role !== "Admin") {
            ui.showError("Access denied. Admin privileges required.");
            setTimeout(() => window.location.href = "dashboard.html", 2000);
            return;
        }
        await Promise.all([this.loadProjects(), this.loadUsers()]);
        this.setupEventListeners();
    },
    async loadProjects() {
        try {
            const r = await adminApi.getProjects();
            adminUI.displayProjects(r.projects);
        } catch {
            const c = document.getElementById("projects-list");
            if (c) c.innerHTML = '<div class="text-center text-red-500">Failed to load projects</div>';
        }
    },
    async loadUsers() {
        try {
            adminUI.displayUsers([
                { user_id: 1, name: "Admin User", email: "admin@bugsage.com", role: "Admin" },
                { user_id: 2, name: "Alice Johnson", email: "alice@bugsage.com", role: "Developer" },
                { user_id: 3, name: "Bob Smith", email: "bob@bugsage.com", role: "Tester" },
                { user_id: 4, name: "Carol Davis", email: "carol@bugsage.com", role: "Developer" },
                { user_id: 5, name: "David Wilson", email: "david@bugsage.com", role: "Tester" }
            ]);
        } catch {
            const c = document.getElementById("users-list");
            if (c) c.innerHTML = '<div class="text-center text-red-500">Failed to load users</div>';
        }
    },
    setupEventListeners() {
        const addBtn = document.getElementById("add-project-btn");
        if (addBtn) addBtn.addEventListener("click", adminUI.showProjectModal);
        const form = document.getElementById("project-form");
        if (form) form.addEventListener("submit", e => this.handleProjectSubmission(e));
        document.querySelectorAll(".modal-close").forEach(btn => btn.addEventListener("click", adminUI.closeModal));
        document.addEventListener("click", e => e.target.classList.contains("modal") && adminUI.closeModal());
    },
    async handleProjectSubmission(e) {
        e.preventDefault();
        const name = document.getElementById("project-name").value.trim();
        const desc = document.getElementById("project-description").value.trim();
        if (!name) return ui.showError("Project name is required");
        try {
            const fd = new FormData();
            fd.append("name", name);
            fd.append("description", desc);
            const r = await adminApi.createProject(fd);
            if (r.success) {
                ui.showSuccess("Project created successfully!");
                adminUI.closeModal();
                this.loadProjects();
            }
        } catch (err) {
            ui.showError(err.message || "Failed to create project");
        }
    },
    editProject(id) { ui.showError("Edit project functionality not implemented yet"); },
    editUser(id) { ui.showError("Edit user functionality not implemented yet"); }
};

document.addEventListener("DOMContentLoaded", () => admin.init());
window.admin = admin;
