<?php
require_once '../config/config.php';
header('Content-Type: application/json');
setCorsHeaders();
handlePreflight();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch($method) {
        case 'GET': handleGet($action); break;
        case 'POST': handlePost($action); break;
        case 'PUT': handlePut($action); break;
        default: jsonResponse(['error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    debugLog("Bugs API Exception", ['message' => $e->getMessage()]);
    jsonResponse(['error' => 'Internal server error'], 500);
}

function handleGet($action) {
    requireLogin();
    switch($action) {
        case 'list': getBugsList(); break;
        case 'details': getBugDetails(); break;
        case 'search': searchBugs(); break;
        default: jsonResponse(['error' => 'Invalid action'], 400);
    }
}

function handlePost($action) {
    requireLogin();
    switch($action) {
        case 'create': createBug(); break;
        case 'comment': addComment(); break;
        default: jsonResponse(['error' => 'Invalid action'], 400);
    }
}

function handlePut($action) {
    requireLogin();
    if ($action === 'update') updateBug();
    else jsonResponse(['error' => 'Invalid action'], 400);
}

function getBugsList() {
    global $pdo;
    $page = max(1, intval($_GET['page'] ?? 1));
    $perPage = intval($_GET['per_page'] ?? BUGS_PER_PAGE);
    $offset = ($page - 1) * $perPage;
    
    $filters = buildFilters();
    $sql = "SELECT b.*, p.name project_name, reporter.name reporter_name, assignee.name assignee_name
            FROM bugs b
            LEFT JOIN projects p ON b.project_id = p.project_id
            LEFT JOIN users reporter ON b.reporter_id = reporter.user_id
            LEFT JOIN users assignee ON b.assignee_id = assignee.user_id
            {$filters['where']}
            ORDER BY b.created_at DESC
            LIMIT $perPage OFFSET $offset";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($filters['params']);
    $bugs = $stmt->fetchAll();
    
    $countSql = "SELECT COUNT(*) FROM bugs b {$filters['where']}";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($filters['params']);
    $total = $countStmt->fetchColumn();
    
    jsonResponse([
        'bugs' => $bugs,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $perPage,
            'total_pages' => ceil($total / $perPage),
            'total_bugs' => $total
        ]
    ]);
}

function buildFilters() {
    $filters = [];
    $params = [];
    
    foreach(['status', 'priority', 'project'] as $field) {
        if (!empty($_GET[$field])) {
            $filters[] = "b.$field = ?";
            $params[] = $_GET[$field];
        }
    }
    
    if (!empty($_GET['assignee'])) {
        $filters[] = "b.assignee_id = ?";
        $params[] = $_GET['assignee'] === 'me' ? $_SESSION['user_id'] : $_GET['assignee'];
    }
    
    return [
        'where' => $filters ? 'WHERE ' . implode(' AND ', $filters) : '',
        'params' => $params
    ];
}

function getBugDetails() {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'Bug ID required'], 400);
    
    global $pdo;
    $bug = fetchBugById($id);
    if (!$bug) jsonResponse(['error' => 'Bug not found'], 404);
    
    jsonResponse([
        'bug' => $bug,
        'comments' => fetchCommentsByBugId($id),
        'attachments' => fetchAttachmentsByBugId($id)
    ]);
}

function fetchBugById($id) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT b.*, p.name project_name, reporter.name reporter_name, assignee.name assignee_name
                          FROM bugs b
                          LEFT JOIN projects p ON b.project_id = p.project_id
                          LEFT JOIN users reporter ON b.reporter_id = reporter.user_id
                          LEFT JOIN users assignee ON b.assignee_id = assignee.user_id
                          WHERE b.bug_id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
}

function fetchCommentsByBugId($id) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT c.*, u.name user_name FROM comments c JOIN users u ON c.user_id = u.user_id WHERE c.bug_id = ? ORDER BY c.created_at ASC");
    $stmt->execute([$id]);
    return $stmt->fetchAll();
}

function fetchAttachmentsByBugId($id) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT * FROM attachments WHERE bug_id = ? ORDER BY uploaded_at ASC");
    $stmt->execute([$id]);
    return $stmt->fetchAll();
}

function createBug() {
    $title = sanitizeInput($_POST['title'] ?? '');
    $description = sanitizeInput($_POST['description'] ?? '');
    $priority = sanitizeInput($_POST['priority'] ?? 'Medium');
    $projectId = intval($_POST['project_id'] ?? 0) ?: null;
    $assigneeId = intval($_POST['assignee_id'] ?? 0) ?: null;
    $force = isset($_POST['force_create']) && $_POST['force_create'] === 'true';
    
    if (!$title || !$description) jsonResponse(['error' => 'Title and description required'], 400);
    if (!in_array($priority, ['Low', 'Medium', 'High', 'Critical'])) jsonResponse(['error' => 'Invalid priority'], 400);
    
    global $pdo;
    
    // Check for duplicates unless forced
    if (!$force && hasDuplicates($title)) {
        jsonResponse([
            'warning' => 'Potential duplicates found',
            'duplicates' => findDuplicates($title)
        ]);
    }
    
    validateReferences($projectId, $assigneeId);
    
    $stmt = $pdo->prepare("INSERT INTO bugs (project_id, title, description, priority, assignee_id, reporter_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
    if ($stmt->execute([$projectId, $title, $description, $priority, $assigneeId, $_SESSION['user_id']])) {
        jsonResponse(['success' => true, 'bug_id' => $pdo->lastInsertId()]);
    } else {
        jsonResponse(['error' => 'Failed to create bug'], 500);
    }
}

function hasDuplicates($title) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM bugs WHERE title LIKE ?");
    $stmt->execute(['%' . $title . '%']);
    return $stmt->fetchColumn() > 0;
}

function findDuplicates($title) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT bug_id, title FROM bugs WHERE title LIKE ? OR description LIKE ? LIMIT 5");
    $term = '%' . $title . '%';
    $stmt->execute([$term, $term]);
    return $stmt->fetchAll();
}

function validateReferences($projectId, $assigneeId) {
    global $pdo;
    if ($projectId) {
        $stmt = $pdo->prepare("SELECT project_id FROM projects WHERE project_id = ?");
        $stmt->execute([$projectId]);
        if (!$stmt->fetch()) jsonResponse(['error' => 'Invalid project'], 400);
    }
    if ($assigneeId) {
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE user_id = ?");
        $stmt->execute([$assigneeId]);
        if (!$stmt->fetch()) jsonResponse(['error' => 'Invalid assignee'], 400);
    }
}

function updateBug() {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'Bug ID required'], 400);
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) jsonResponse(['error' => 'Invalid JSON'], 400);
    
    global $pdo;
    $current = fetchBugById($id);
    if (!$current) jsonResponse(['error' => 'Bug not found'], 404);
    
    $updates = buildUpdateQuery($input, $current, $id);
    if (!$updates['fields']) jsonResponse(['error' => 'No fields to update'], 400);
    
    $sql = "UPDATE bugs SET " . implode(',', $updates['fields']) . ", updated_at = NOW() WHERE bug_id = ?";
    $updates['params'][] = $id;
    
    $stmt = $pdo->prepare($sql);
    if ($stmt->execute($updates['params'])) {
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed to update bug'], 500);
    }
}

function buildUpdateQuery($input, $current, $id) {
    global $pdo;
    $updates = ['fields' => [], 'params' => []];
    
    foreach(['title', 'description', 'priority', 'status', 'assignee_id'] as $field) {
        if (isset($input[$field])) {
            $updates['fields'][] = "$field = ?";
            $updates['params'][] = $input[$field];
            
            if ($current[$field] != $input[$field]) {
                logBugHistory($id, $field, $current[$field], $input[$field]);
            }
        }
    }
    
    return $updates;
}

function logBugHistory($id, $field, $oldValue, $newValue) {
    global $pdo;
    $stmt = $pdo->prepare("INSERT INTO bug_history (bug_id, changed_by, field_changed, old_value, new_value, changed_at) VALUES (?, ?, ?, ?, ?, NOW())");
    $stmt->execute([$id, $_SESSION['user_id'], $field, $oldValue, $newValue]);
}

function addComment() {
    $bugId = intval($_POST['bug_id'] ?? 0);
    $comment = sanitizeInput($_POST['comment'] ?? '');
    
    if (!$bugId || !$comment) jsonResponse(['error' => 'Bug ID and comment required'], 400);
    
    global $pdo;
    if (!fetchBugById($bugId)) jsonResponse(['error' => 'Bug not found'], 404);
    
    $stmt = $pdo->prepare("INSERT INTO comments (bug_id, user_id, comment_text, created_at) VALUES (?, ?, ?, NOW())");
    if ($stmt->execute([$bugId, $_SESSION['user_id'], $comment])) {
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed to add comment'], 500);
    }
}

function searchBugs() {
    $query = sanitizeInput($_GET['q'] ?? '');
    if (!$query) jsonResponse(['error' => 'Search query required'], 400);
    
    global $pdo;
    $term = '%' . $query . '%';
    $stmt = $pdo->prepare("SELECT b.*, p.name project_name, reporter.name reporter_name, assignee.name assignee_name
                          FROM bugs b
                          LEFT JOIN projects p ON b.project_id = p.project_id
                          LEFT JOIN users reporter ON b.reporter_id = reporter.user_id
                          LEFT JOIN users assignee ON b.assignee_id = assignee.user_id
                          WHERE b.title LIKE ? OR b.description LIKE ?
                          ORDER BY b.created_at DESC LIMIT 20");
    $stmt->execute([$term, $term]);
    jsonResponse(['results' => $stmt->fetchAll()]);
}
?>