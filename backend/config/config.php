<?php
// BugSage Configuration - Simplified and optimized
if (session_status() == PHP_SESSION_NONE) session_start();

// Constants
define('APP_NAME', 'BugSage');
define('BASE_URL', 'http://localhost/bugsagev3/');
define('UPLOAD_DIR', '../uploads/');
define('MAX_FILE_SIZE', 5 * 1024 * 1024);
define('ALLOWED_EXTENSIONS', ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt']);
define('BUGS_PER_PAGE', 20);
define('PASSWORD_MIN_LENGTH', 6);

require_once 'database.php';

// Auth functions
function isLoggedIn() { return !empty($_SESSION['user_id']); }
function requireLogin() { if (!isLoggedIn()) jsonResponse(['error' => 'Authentication required'], 401); }
function getUserRole() { return $_SESSION['user_role'] ?? null; }
function isAdmin() { return getUserRole() === 'Admin'; }

// Utility functions
function sanitizeInput($data) { return $data ? htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8') : ''; }
function isValidEmail($email) { return filter_var($email, FILTER_VALIDATE_EMAIL) !== false; }
function formatDate($date) { return date('M j, Y g:i A', strtotime($date)); }

// Response helper
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, must-revalidate');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit();
}

// Debug function
function debugLog($message, $data = null) {
    error_log("BugSage - $message" . ($data ? ': ' . print_r($data, true) : ''));
}

// CORS helper
function setCorsHeaders() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
    header('Access-Control-Allow-Credentials: true');
}

function handlePreflight() {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit(0);
    }
}
?>