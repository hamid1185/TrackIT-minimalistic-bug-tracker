// Bug form JavaScript (minimized)

const bugFormApi = {
  getProjects: () => api.request("projects.php?action=list"),
  getUsers: () => api.request("users.php?action=list"),
  createBug: formData => api.request("bugs.php?action=create", { method: "POST", body: formData })
};

const bugFormUI = {
  populateProjects(projects = []) {
    const sel = document.getElementById("project_id");
    if (!sel) return;
    projects.forEach(p => sel.appendChild(Object.assign(document.createElement("option"), { value: p.project_id, textContent: p.name })));
  },
  populateUsers(users = []) {
    const sel = document.getElementById("assignee_id");
    if (!sel) return;
    while (sel.children.length > 1) sel.removeChild(sel.lastChild);
    users.forEach(u => sel.appendChild(Object.assign(document.createElement("option"), { value: u.user_id, textContent: `${u.name} (${u.role})` })));
  },
  displayDuplicateWarning(duplicates = []) {
    const c = document.getElementById("duplicate-warning");
    if (!c) return;
    c.innerHTML = `
      <div>
        <strong>Potential duplicates found:</strong>
        <ul>${duplicates.map(d => `<li><a href="bugdetail.html?id=${d.bug_id}">#${d.bug_id}: ${format.escapeHtml(d.title)}</a></li>`).join("")}</ul>
        <div>
          <button type="button" id="continue-anyway" class="btn btn-warning btn-sm">Create Anyway</button>
          <button type="button" id="cancel-create" class="btn btn-secondary btn-sm">Cancel</button>
        </div>
      </div>`;
    c.style.display = "block";
    document.getElementById("continue-anyway").onclick = () => bugForm.forceCreate();
    document.getElementById("cancel-create").onclick = () => (c.style.display = "none");
  }
};

const bugForm = {
  async init() {
    if (!await auth.check()) return;
    try {
      const [projects, users] = await Promise.all([
        bugFormApi.getProjects().catch(() => ({ projects: [] })),
        bugFormApi.getUsers().catch(() => ({ users: this.getMockUsers() }))
      ]);
      bugFormUI.populateProjects(projects.projects);
      bugFormUI.populateUsers(users.users);
    } catch (e) { console.error(e); }
    this.setupEventListeners();
  },
  getMockUsers() {
    return [
      { user_id: 1, name: 'Admin User', role: 'Admin' },
      { user_id: 2, name: 'Alice Johnson', role: 'Developer' },
      { user_id: 3, name: 'Bob Smith', role: 'Tester' },
      { user_id: 4, name: 'Carol Davis', role: 'Developer' },
      { user_id: 5, name: 'David Wilson', role: 'Tester' }
    ];
  },
  setupEventListeners() {
    document.getElementById("bug-form")?.addEventListener("submit", e => this.handleSubmission(e));
    document.getElementById("cancel-btn")?.addEventListener("click", () => window.location.href = "buglist.html");
  },
  async handleSubmission(e) {
    e.preventDefault();
    const fd = this.getFormData();
    if (!fd.title || !fd.description) return ui.showError("Title and description are required");
    try {
      const res = await bugFormApi.createBug(this.buildFormData(fd));
      if (res.warning && res.duplicates) bugFormUI.displayDuplicateWarning(res.duplicates);
      else if (res.success) {
        ui.showSuccess("Bug created successfully!");
        setTimeout(() => window.location.href = `bugdetail.html?id=${res.bug_id}`, 1500);
      }
    } catch (err) {
      ui.showError(err.message || "Failed to create bug");
    }
  },
  getFormData() {
    return {
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      priority: document.getElementById("priority").value,
      projectId: document.getElementById("project_id").value,
      assigneeId: document.getElementById("assignee_id").value
    };
  },
  buildFormData(fd) {
    const f = new FormData();
    f.append("title", fd.title);
    f.append("description", fd.description);
    f.append("priority", fd.priority);
    if (fd.projectId) f.append("project_id", fd.projectId);
    if (fd.assigneeId) f.append("assignee_id", fd.assigneeId);
    return f;
  },
  async forceCreate() {
    const fd = this.getFormData(), f = this.buildFormData(fd);
    f.append("force_create", "true");
    try {
      const res = await bugFormApi.createBug(f);
      if (res.success) {
        ui.showSuccess("Bug created successfully!");
        setTimeout(() => window.location.href = `bugdetail.html?id=${res.bug_id}`, 1500);
      }
    } catch (err) {
      ui.showError(err.message || "Failed to create bug");
    }
  }
};

document.addEventListener("DOMContentLoaded", () => bugForm.init());
