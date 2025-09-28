<?php
require_once '../config/config.php';
header('Content-Type: application/json');
setCorsHeaders();
handlePreflight();
requireLogin();

$action = $_GET['action'] ?? 'list';

try {
    if ($action === 'list') getUsersList();
    else jsonResponse(['error' => 'Invalid action'], 400);
} catch (Exception $e) {
    debugLog("Users Exception", ['message' => $e->getMessage()]);
    jsonResponse(['error' => 'Internal server error'], 500);
}

function getUsersList() {
    global $pdo;
    try {
        $stmt = $pdo->query("SELECT user_id, name, email, role FROM users ORDER BY name ASC");
        jsonResponse(['users' => $stmt->fetchAll()]);
    } catch (PDOException $e) {
        debugLog("Users fetch error", ['error' => $e->getMessage()]);
        jsonResponse(['error' => 'Failed to fetch users'], 500);
    }
}
?>