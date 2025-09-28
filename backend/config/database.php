<?php
// Database configuration - Simplified
$host = 'localhost';
$dbname = 'bugsage';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);
    $pdo->query("SELECT 1");
} catch(PDOException $e) {
    error_log("Database connection failed: " . $e->getMessage());
    if (!headers_sent()) {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
    }
    exit();
}

// Auto-create database if needed
function checkDatabase() {
    global $host, $username, $password, $dbname;
    try {
        $tempPdo = new PDO("mysql:host=$host;charset=utf8mb4", $username, $password);
        $tempPdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $stmt = $tempPdo->prepare("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?");
        $stmt->execute([$dbname]);
        if (!$stmt->fetch()) {
            $tempPdo->exec("CREATE DATABASE `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            error_log("Database '$dbname' created successfully");
        }
    } catch(PDOException $e) {
        error_log("Database check/creation failed: " . $e->getMessage());
    }
}
checkDatabase();
?>