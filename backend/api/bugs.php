<?php
require_once '../config/config.php';
header('Content-Type: application/json');
setCorsHeaders(); handlePreflight();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
debugLog("Bugs API called", ['method'=>$method, 'action'=>$action, 'user_id'=>$_SESSION['user_id']??'not_logged_in']);

try {
    $handlers = [
        'GET' => fn($a)=>handleGet($a),
        'POST' => fn($a)=>handlePost($a),
        'PUT' => fn($a)=>handlePut($a)
    ];
    $handlers[$method]($action) ?? jsonResponse(['error'=>'Method not allowed'],405);
} catch (Exception $e) {
    debugLog("Bugs API Exception", ['message'=>$e->getMessage()]);
    jsonResponse(['error'=>'Internal server error: '.$e->getMessage()],500);
}

function handleGet($action) {
    $map = ['list'=>'getBugsList','details'=>'getBugDetails','search'=>'searchBugs'];
    isset($map[$action]) ? $map[$action]() : jsonResponse(['error'=>'Invalid GET action'],400);
}
function handlePost($action) {
    $map = ['create'=>'createBug','comment'=>'addComment'];
    isset($map[$action]) ? $map[$action]() : jsonResponse(['error'=>'Invalid POST action'],400);
}
function handlePut($action) {
    $action==='update' ? updateBug() : jsonResponse(['error'=>'Invalid PUT action'],400);
}

function getBugsList() {
    requireLogin(); global $pdo;
    $page = max(1,intval($_GET['page']??1));
    $perPage = intval($_GET['per_page']??BUGS_PER_PAGE);
    $offset = ($page-1)*$perPage;
    $f = buildFilters();
    $sql = "SELECT b.*, p.name project_name, reporter.name reporter_name, assignee.name assignee_name
        FROM bugs b
        LEFT JOIN projects p ON b.project_id=p.project_id
        LEFT JOIN users reporter ON b.reporter_id=reporter.user_id
        LEFT JOIN users assignee ON b.assignee_id=assignee.user_id
        {$f['where']}
        ORDER BY b.created_at DESC
        LIMIT $perPage OFFSET $offset";
    $bugs = $pdo->prepare($sql); $bugs->execute($f['params']);
    $total = $pdo->prepare("SELECT COUNT(*) FROM bugs b {$f['where']}"); $total->execute($f['params']);
    jsonResponse([
        'bugs'=>$bugs->fetchAll(),
        'pagination'=>[
            'current_page'=>$page,
            'per_page'=>$perPage,
            'total_pages'=>ceil($total->fetchColumn()/$perPage),
            'total_bugs'=>$total->fetchColumn()
        ]
    ]);
}
function buildFilters() {
    $filters=[]; $params=[];
    foreach(['status','priority','project'] as $f)
        if(!empty($_GET[$f])){$filters[]="b.$f=?";$params[]=$_GET[$f];}
    if(!empty($_GET['assignee'])){$filters[]="b.assignee_id=?";$params[]=$_GET['assignee']=='me'?$_SESSION['user_id']:$_GET['assignee'];}
    return ['where'=>$filters?'WHERE '.implode(' AND ',$filters):'','params'=>$params];
}
function getBugDetails() {
    requireLogin(); $id=intval($_GET['id']??0); if(!$id)jsonResponse(['error'=>'Bug ID required'],400);
    global $pdo; $bug=fetchBugById($id); if(!$bug)jsonResponse(['error'=>'Bug not found'],404);
    jsonResponse(['bug'=>$bug,'comments'=>fetchCommentsByBugId($id),'attachments'=>fetchAttachmentsByBugId($id)]);
}
function fetchBugById($id) {
    global $pdo;
    $stmt=$pdo->prepare("SELECT b.*, p.name project_name, reporter.name reporter_name, assignee.name assignee_name
        FROM bugs b
        LEFT JOIN projects p ON b.project_id=p.project_id
        LEFT JOIN users reporter ON b.reporter_id=reporter.user_id
        LEFT JOIN users assignee ON b.assignee_id=assignee.user_id
        WHERE b.bug_id=?"); $stmt->execute([$id]);
    return $stmt->fetch();
}
function fetchCommentsByBugId($id) {
    global $pdo;
    $stmt=$pdo->prepare("SELECT c.*, u.name user_name FROM comments c JOIN users u ON c.user_id=u.user_id WHERE c.bug_id=? ORDER BY c.created_at ASC"); $stmt->execute([$id]);
    return $stmt->fetchAll();
}
function fetchAttachmentsByBugId($id) {
    global $pdo;
    $stmt=$pdo->prepare("SELECT * FROM attachments WHERE bug_id=? ORDER BY uploaded_at ASC"); $stmt->execute([$id]);
    return $stmt->fetchAll();
}
function createBug() {
    requireLogin();
    $t=sanitizeInput($_POST['title']??''); $d=sanitizeInput($_POST['description']??''); $p=sanitizeInput($_POST['priority']??'Medium');
    $proj=intval($_POST['project_id']??0)?:null; $assignee=intval($_POST['assignee_id']??0)?:null;
    $force=isset($_POST['force_create'])&&$_POST['force_create']=='true';
    if(!$t||!$d)jsonResponse(['error'=>'Title and description required'],400);
    if(!in_array($p,['Low','Medium','High','Critical']))jsonResponse(['error'=>'Invalid priority'],400);
    global $pdo;
    if(!$force&&hasDuplicates($t))jsonResponse(['warning'=>'Potential duplicates found','duplicates'=>findDuplicates($t)]);
    validateReferences($proj,$assignee);
    $stmt=$pdo->prepare("INSERT INTO bugs (project_id,title,description,priority,assignee_id,reporter_id,created_at) VALUES (?,?,?,?,?,?,NOW())");
    $stmt->execute([$proj,$t,$d,$p,$assignee,$_SESSION['user_id']]) ?
        jsonResponse(['success'=>true,'bug_id'=>$pdo->lastInsertId(),'message'=>'Bug created']) :
        jsonResponse(['error'=>'Failed to create bug'],500);
}
function hasDuplicates($t) {
    global $pdo; $stmt=$pdo->prepare("SELECT COUNT(*) FROM bugs WHERE title LIKE ?"); $stmt->execute(['%'.$t.'%']);
    return $stmt->fetchColumn()>0;
}
function findDuplicates($t) {
    global $pdo; $stmt=$pdo->prepare("SELECT bug_id,title FROM bugs WHERE title LIKE ? OR description LIKE ? LIMIT 5");
    $term='%'.$t.'%'; $stmt->execute([$term,$term]); return $stmt->fetchAll();
}
function validateReferences($proj,$assignee) {
    global $pdo;
    if($proj){$s=$pdo->prepare("SELECT project_id FROM projects WHERE project_id=?");$s->execute([$proj]);if(!$s->fetch())jsonResponse(['error'=>'Invalid project'],400);}
    if($assignee){$s=$pdo->prepare("SELECT user_id FROM users WHERE user_id=?");$s->execute([$assignee]);if(!$s->fetch())jsonResponse(['error'=>'Invalid assignee'],400);}
}
function updateBug() {
    requireLogin(); $id=intval($_GET['id']??0); if(!$id)jsonResponse(['error'=>'Bug ID required'],400);
    $input=json_decode(file_get_contents('php://input'),true); if(!$input)jsonResponse(['error'=>'Invalid JSON'],400);
    global $pdo; $cur=fetchBugById($id); if(!$cur)jsonResponse(['error'=>'Bug not found'],404);
    $upd=buildUpdateQuery($input,$cur,$id); if(!$upd['fields'])jsonResponse(['error'=>'No fields to update'],400);
    $sql="UPDATE bugs SET ".implode(',',$upd['fields']).",updated_at=NOW() WHERE bug_id=?"; $upd['params'][]=$id;
    $stmt=$pdo->prepare($sql);
    $stmt->execute($upd['params']) ? jsonResponse(['success'=>true,'message'=>'Bug updated']) : jsonResponse(['error'=>'Failed to update bug'],500);
}
function buildUpdateQuery($input,$cur,$id) {
    global $pdo; $u=['fields'=>[],'params'=>[]];
    foreach(['title','description','priority','status','assignee_id'] as $f)
        if(isset($input[$f])){$u['fields'][]="$f=?";$u['params'][]=$input[$f];if($cur[$f]!=$input[$f])logBugHistory($id,$f,$cur[$f],$input[$f]);}
    return $u;
}
function logBugHistory($id,$f,$old,$new) {
    global $pdo;
    $stmt=$pdo->prepare("INSERT INTO bug_history (bug_id,changed_by,field_changed,old_value,new_value,changed_at) VALUES (?,?,?,?,?,NOW())");
    $stmt->execute([$id,$_SESSION['user_id'],$f,$old,$new]);
}
function addComment() {
    requireLogin(); $id=intval($_POST['bug_id']??0); $c=sanitizeInput($_POST['comment']??'');
    if(!$id||!$c)jsonResponse(['error'=>'Bug ID and comment required'],400);
    global $pdo; if(!fetchBugById($id))jsonResponse(['error'=>'Bug not found'],404);
    $stmt=$pdo->prepare("INSERT INTO comments (bug_id,user_id,comment_text,created_at) VALUES (?,?,?,NOW())");
    $stmt->execute([$id,$_SESSION['user_id'],$c]) ? jsonResponse(['success'=>true,'message'=>'Comment added']) : jsonResponse(['error'=>'Failed to add comment'],500);
}
function searchBugs() {
    requireLogin(); $q=sanitizeInput($_GET['q']??''); if(!$q)jsonResponse(['error'=>'Search query required'],400);
    global $pdo; $term='%'.$q.'%';
    $stmt=$pdo->prepare("SELECT b.*, p.name project_name, reporter.name reporter_name, assignee.name assignee_name
        FROM bugs b
        LEFT JOIN projects p ON b.project_id=p.project_id
        LEFT JOIN users reporter ON b.reporter_id=reporter.user_id
        LEFT JOIN users assignee ON b.assignee_id=assignee.user_id
        WHERE b.title LIKE ? OR b.description LIKE ?
        ORDER BY b.created_at DESC
        LIMIT 20"); $stmt->execute([$term,$term]);
    jsonResponse(['results'=>$stmt->fetchAll()]);
}
?>
