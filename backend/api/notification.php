// backend/api/notifications.php
<?php
require_once '../config/database.php';
header('Content-Type: application/json');

session_start();
if (!isset($_SESSION['user_id']) || !isset($_GET['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$user_id = $_GET['user_id'];
$role = $_SESSION['role'];

// Role-based query (example)
$query = "SELECT notification_id, message, is_read, created_at 
          FROM Notifications 
          WHERE user_id = ? 
          ORDER BY created_at DESC";
$stmt = $pdo->prepare($query);
$stmt->execute([$user_id]);
$notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($notifications);
?>