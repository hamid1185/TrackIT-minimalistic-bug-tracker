<?php
require_once '../config/config.php';
header('Content-Type: application/json');
setCorsHeaders();
handlePreflight();

$action = $_GET['action'] ?? '';
debugLog("Auth API", ['method' => $_SERVER['REQUEST_METHOD'], 'action' => $action]);

try {
    switch($action) {
        case 'login': handleLogin(); break;
        case 'register': handleRegister(); break;
        case 'logout': handleLogout(); break;
        case 'check': checkAuth(); break;
        default: jsonResponse(['error' => 'Invalid action'], 400);
    }
} catch (Exception $e) {
    debugLog("Auth Exception", ['message' => $e->getMessage()]);
    jsonResponse(['error' => 'Internal server error'], 500);
}

function handleLogin() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
    
    $email = sanitizeInput($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    
    if (!$email || !$password) jsonResponse(['error' => 'Email and password required'], 400);
    if (!isValidEmail($email)) jsonResponse(['error' => 'Invalid email format'], 400);

    global $pdo;
    $stmt = $pdo->prepare("SELECT user_id, name, email, password_hash, role FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if ($user && password_verify($password, $user['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION = [
            'user_id' => $user['user_id'],
            'user_name' => $user['name'],
            'user_email' => $user['email'],
            'user_role' => $user['role'],
            'login_time' => time()
        ];
        jsonResponse([
            'success' => true,
            'authenticated' => true,
            'user' => [
                'id' => $user['user_id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role']
            ]
        ]);
    } else {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }
}

function handleRegister() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
    
    $name = sanitizeInput($_POST['name'] ?? '');
    $email = sanitizeInput($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $role = sanitizeInput($_POST['role'] ?? 'Developer');
    
    if (!$name || !$email || !$password) jsonResponse(['error' => 'All fields required'], 400);
    if (!isValidEmail($email)) jsonResponse(['error' => 'Invalid email'], 400);
    if (strlen($password) < PASSWORD_MIN_LENGTH) jsonResponse(['error' => 'Password too short'], 400);
    if (!in_array($role, ['Developer', 'Tester', 'Admin'])) jsonResponse(['error' => 'Invalid role'], 400);

    global $pdo;
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) jsonResponse(['error' => 'Email already exists'], 400);
    
    $stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, NOW())");
    if ($stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $role])) {
        jsonResponse(['success' => true, 'message' => 'Registration successful']);
    } else {
        jsonResponse(['error' => 'Registration failed'], 500);
    }
}

function handleLogout() {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
    }
    session_destroy();
    jsonResponse(['success' => true, 'authenticated' => false]);
}

function checkAuth() {
    if (isLoggedIn()) {
        if (isset($_SESSION['login_time']) && (time() - $_SESSION['login_time']) > 86400) {
            session_destroy();
            jsonResponse(['authenticated' => false, 'message' => 'Session expired']);
        }
        jsonResponse([
            'authenticated' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'name' => $_SESSION['user_name'],
                'email' => $_SESSION['user_email'],
                'role' => $_SESSION['user_role']
            ]
        ]);
    } else {
        jsonResponse(['authenticated' => false]);
    }
}
?>