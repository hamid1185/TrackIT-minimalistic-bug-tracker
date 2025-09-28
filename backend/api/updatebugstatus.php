<?php
require_once '../config/config.php';
header('Content-Type: application/json');
setCorsHeaders();
handlePreflight();
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);

$bugId = intval($_POST['bug_id'] ?? 0);
$newStatus = sanitizeInput($_POST['status'] ?? '');
$validStatuses = ['New', 'In Progress', 'Resolved', 'Closed'];

if (!$bugId || !in_array($newStatus, $validStatuses)) {
    jsonResponse(['error' => 'Invalid bug ID or status'], 400);
}

global $pdo;
try {
    $stmt = $pdo->prepare("SELECT status FROM bugs WHERE bug_id = ?");
    $stmt->execute([$bugId]);
    $currentStatus = $stmt->fetchColumn();

    if (!$currentStatus) jsonResponse(['error' => 'Bug not found'], 404);
    if ($currentStatus === $newStatus) jsonResponse(['success' => true, 'message' => 'Status unchanged']);

    $stmt = $pdo->prepare("UPDATE bugs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE bug_id = ?");
    if ($stmt->execute([$newStatus, $bugId])) {
        $pdo->prepare("INSERT INTO bug_history (bug_id, changed_by, field_changed, old_value, new_value) VALUES (?, ?, 'status', ?, ?)")
            ->execute([$bugId, $_SESSION['user_id'], $currentStatus, $newStatus]);
        jsonResponse(['success' => true, 'message' => 'Status updated']);
    } else {
        jsonResponse(['error' => 'Failed to update status'], 500);
    }
} catch (PDOException $e) {
    jsonResponse(['error' => 'Database error'], 500);
}
?>