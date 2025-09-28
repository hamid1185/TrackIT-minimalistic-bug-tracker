<?php
require_once '../config/config.php';
header('Content-Type: application/json');
setCorsHeaders();
handlePreflight();
requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch($method) {
        case 'GET':
            if ($action === 'list') getProjects();
            else jsonResponse(['error' => 'Invalid action'], 400);
            break;
        case 'POST':
            if ($action === 'create') createProject();
            else jsonResponse(['error' => 'Invalid action'], 400);
            break;
        default:
            jsonResponse(['error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    debugLog("Projects Exception", ['message' => $e->getMessage()]);
    jsonResponse(['error' => 'Internal server error'], 500);
}

function getProjects() {
    global $pdo;
    try {
        $stmt = $pdo->query("SELECT p.*, COUNT(b.bug_id) as bug_count
                            FROM projects p
                            LEFT JOIN bugs b ON p.project_id = b.project_id
                            GROUP BY p.project_id
                            ORDER BY p.name");
        jsonResponse(['projects' => $stmt->fetchAll()]);
    } catch (PDOException $e) {
        debugLog("Projects fetch error", ['error' => $e->getMessage()]);
        jsonResponse(['error' => 'Failed to fetch projects'], 500);
    }
}

function createProject() {
    if (!isAdmin()) jsonResponse(['error' => 'Admin access required'], 403);
    
    $name = sanitizeInput($_POST['name'] ?? '');
    $description = sanitizeInput($_POST['description'] ?? '');
    
    if (empty($name)) jsonResponse(['error' => 'Project name required'], 400);
    
    global $pdo;
    try {
        $stmt = $pdo->prepare("INSERT INTO projects (name, description) VALUES (?, ?)");
        if ($stmt->execute([$name, $description])) {
            jsonResponse(['success' => true, 'project_id' => $pdo->lastInsertId()]);
        } else {
            jsonResponse(['error' => 'Failed to create project'], 500);
        }
    } catch (PDOException $e) {
        debugLog("Project creation error", ['error' => $e->getMessage()]);
        jsonResponse(['error' => 'Database error'], 500);
    }
}
?>