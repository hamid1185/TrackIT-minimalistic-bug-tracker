const API_BASE = '/bugsagev3/backend/api/';

const apiRequest = async (url, options = {}) => {
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
};

const showMsg = (msg, id, isSuccess = false) => {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', isSuccess ? 3000 : 5000);
    } else {
        alert((isSuccess ? 'Success: ' : 'Error: ') + msg);
    }
};

const hideMsgs = () => {
    ['error-message', 'success-message'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
};

const setBtnLoading = (btn, loading, txt) => {
    btn.disabled = loading;
    btn.innerHTML = loading
        ? `<i class="fas fa-spinner fa-spin"></i> ${txt.includes('Sign') ? 'Signing in...' : 'Creating Account...'}`
        : txt;
};

const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateLogin = (email, pwd) => {
    if (!email || !pwd) throw new Error("Please fill in all fields");
    if (!isValidEmail(email)) throw new Error("Please enter a valid email address");
};

const validateRegister = (name, email, pwd) => {
    if (!name || !email || !pwd) throw new Error("Please fill in all fields");
    if (!isValidEmail(email)) throw new Error("Please enter a valid email address");
    if (pwd.length < 6) throw new Error("Password must be at least 6 characters long");
};

const checkAuthStatus = async () => {
    try {
        const res = await apiRequest("auth.php?action=check");
        if (res.authenticated) window.location.href = "dashboard.html";
    } catch {}
};

const handleLogin = async e => {
    e.preventDefault();
    hideMsgs();
    const email = document.getElementById("email").value.trim();
    const pwd = document.getElementById("password").value;
    try {
        validateLogin(email, pwd);
    } catch (err) {
        showMsg(err.message, 'error-message');
        return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    const txt = btn.innerHTML;
    setBtnLoading(btn, true, txt);
    try {
        const fd = new FormData();
        fd.append("email", email);
        fd.append("password", pwd);
        const res = await apiRequest("auth.php?action=login", { method: "POST", body: fd });
        if (res.success && res.authenticated) {
            showMsg("Login successful! Redirecting...", 'success-message', true);
            setTimeout(() => window.location.href = "dashboard.html", 1000);
        } else throw new Error('Login failed');
    } catch (err) {
        showMsg(err.message || "Login failed. Please try again.", 'error-message');
    } finally {
        setBtnLoading(btn, false, txt);
    }
};

const handleRegister = async e => {
    e.preventDefault();
    hideMsgs();
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const pwd = document.getElementById("password").value;
    const role = document.getElementById("role").value;
    try {
        validateRegister(name, email, pwd);
    } catch (err) {
        showMsg(err.message, 'error-message');
        return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    const txt = btn.innerHTML;
    setBtnLoading(btn, true, txt);
    try {
        const fd = new FormData();
        fd.append("name", name);
        fd.append("email", email);
        fd.append("password", pwd);
        fd.append("role", role);
        const res = await apiRequest("auth.php?action=register", { method: "POST", body: fd });
        if (res.success) {
            showMsg("Registration successful! Redirecting to login...", 'success-message', true);
            setTimeout(() => window.location.href = "login.html", 2000);
        } else throw new Error('Registration failed');
    } catch (err) {
        showMsg(err.message || "Registration failed. Please try again.", 'error-message');
    } finally {
        setBtnLoading(btn, false, txt);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    checkAuthStatus();
    const loginForm = document.getElementById("login-form");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);
    const registerForm = document.getElementById("register-form");
    if (registerForm) registerForm.addEventListener("submit", handleRegister);
    document.querySelectorAll('input').forEach(i => i.addEventListener('focus', hideMsgs));
});

window.authUtils = { showMsg, hideMsgs, apiRequest };
