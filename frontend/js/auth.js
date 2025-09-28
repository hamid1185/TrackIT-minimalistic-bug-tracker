// Authentication page handler - Simplified
const API_BASE = '/bugsagev3/backend/api/';

const authApi = {
    async request(url, options = {}) {
        const fullUrl = url.startsWith('http') ? url : API_BASE + url;
        try {
            const res = await fetch(fullUrl, { credentials: 'same-origin', ...options });
            const type = res.headers.get("content-type");
            if (type && type.includes("application/json")) {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP error! status: ${res.status}`);
                return data;
            }
            throw new Error("Server returned non-JSON response");
        } catch (err) {
            throw err;
        }
    }
};

const authUI = {
    showMsg(msg, id, isSuccess = false) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', isSuccess ? 3000 : 5000);
        } else {
            alert((isSuccess ? 'Success: ' : 'Error: ') + msg);
        }
    },
    
    hideMsgs() {
        ['error-message', 'success-message'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    },
    
    setBtnLoading(btn, loading, txt) {
        btn.disabled = loading;
        btn.innerHTML = loading
            ? `<i class="fas fa-spinner fa-spin"></i> ${txt.includes('Sign') ? 'Signing in...' : 'Creating Account...'}`
            : txt;
    }
};

const authValidation = {
    isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); },
    
    validateLogin(email, pwd) {
        if (!email || !pwd) throw new Error("Please fill in all fields");
        if (!this.isValidEmail(email)) throw new Error("Please enter a valid email address");
    },
    
    validateRegister(name, email, pwd) {
        if (!name || !email || !pwd) throw new Error("Please fill in all fields");
        if (!this.isValidEmail(email)) throw new Error("Please enter a valid email address");
        if (pwd.length < 6) throw new Error("Password must be at least 6 characters long");
    }
};

const authHandlers = {
    async checkAuthStatus() {
        try {
            const res = await authApi.request("auth.php?action=check");
            if (res.authenticated) window.location.href = "dashboard.html";
        } catch {}
    },
    
    async handleLogin(e) {
        e.preventDefault();
        authUI.hideMsgs();
        
        const email = document.getElementById("email").value.trim();
        const pwd = document.getElementById("password").value;
        
        try {
            authValidation.validateLogin(email, pwd);
        } catch (err) {
            authUI.showMsg(err.message, 'error-message');
            return;
        }
        
        const btn = e.target.querySelector('button[type="submit"]');
        const txt = btn.innerHTML;
        authUI.setBtnLoading(btn, true, txt);
        
        try {
            const fd = new FormData();
            fd.append("email", email);
            fd.append("password", pwd);
            const res = await authApi.request("auth.php?action=login", { method: "POST", body: fd });
            
            if (res.success && res.authenticated) {
                authUI.showMsg("Login successful! Redirecting...", 'success-message', true);
                setTimeout(() => window.location.href = "dashboard.html", 1000);
            } else {
                throw new Error('Login failed');
            }
        } catch (err) {
            authUI.showMsg(err.message || "Login failed. Please try again.", 'error-message');
        } finally {
            authUI.setBtnLoading(btn, false, txt);
        }
    },
    
    async handleRegister(e) {
        e.preventDefault();
        authUI.hideMsgs();
        
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const pwd = document.getElementById("password").value;
        const role = document.getElementById("role").value;
        
        try {
            authValidation.validateRegister(name, email, pwd);
        } catch (err) {
            authUI.showMsg(err.message, 'error-message');
            return;
        }
        
        const btn = e.target.querySelector('button[type="submit"]');
        const txt = btn.innerHTML;
        authUI.setBtnLoading(btn, true, txt);
        
        try {
            const fd = new FormData();
            fd.append("name", name);
            fd.append("email", email);
            fd.append("password", pwd);
            fd.append("role", role);
            const res = await authApi.request("auth.php?action=register", { method: "POST", body: fd });
            
            if (res.success) {
                authUI.showMsg("Registration successful! Redirecting to login...", 'success-message', true);
                setTimeout(() => window.location.href = "login.html", 2000);
            } else {
                throw new Error('Registration failed');
            }
        } catch (err) {
            authUI.showMsg(err.message || "Registration failed. Please try again.", 'error-message');
        } finally {
            authUI.setBtnLoading(btn, false, txt);
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    authHandlers.checkAuthStatus();
    
    const loginForm = document.getElementById("login-form");
    if (loginForm) loginForm.addEventListener("submit", authHandlers.handleLogin);
    
    const registerForm = document.getElementById("register-form");
    if (registerForm) registerForm.addEventListener("submit", authHandlers.handleRegister);
    
    document.querySelectorAll('input').forEach(i => i.addEventListener('focus', authUI.hideMsgs));
});