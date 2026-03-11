<?php
/**
 * Hostinger Media Upload API
 * 
 * Handles image, video, and audio uploads to Hostinger storage
 * Replaces Cloudinary for new uploads
 * 
 * Usage: POST multipart/form-data to this endpoint
 * Required fields: file, type (image/video/audio), folder (optional)
 */

// IMPORTANT: display_errors MUST be off in production.
// If it's on, PHP warnings are prepended to the response body BEFORE the JSON
// output, which corrupts it and causes JSON parse failures on the client.
error_reporting(E_ALL);
ini_set('display_errors', 0);  // ← NEVER turn on in production
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/upload_errors.log');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuration
define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('BASE_URL', 'https://socialvibingapp.karr83anime.com/uploads/');
define('MAX_FILE_SIZE', 50 * 1024 * 1024); // 50MB max
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
define('ALLOWED_VIDEO_TYPES', ['video/mp4', 'video/mov', 'video/avi', 'video/webm']);
// M4A files are often detected as video/mp4 because they use the same MP4 container
define('ALLOWED_AUDIO_TYPES', ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'video/mp4', 'audio/3gpp', 'audio/x-caf']);

// API Key for security (optional but recommended)
define('API_KEY', 'sk_svapp_M8nK4xP9wL2vT7hY5jQ3bR6fG1mN0cS');

// Response helper
function sendResponse($success, $data = null, $error = null, $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'error' => $error,
        'timestamp' => time()
    ]);
    exit();
}

// Verify API key (if enabled)
function verifyApiKey() {
    if (!defined('API_KEY') || API_KEY === 'your-secret-api-key-here') {
        return true; // Skip verification if not configured
    }
    
    // getallheaders() is unavailable in some CGI/FastCGI setups; fall back to apache_request_headers
    $headers = function_exists('getallheaders') ? getallheaders() : (function_exists('apache_request_headers') ? apache_request_headers() : []);
    $providedKey = $headers['X-API-Key'] ?? $headers['x-api-key'] ?? $_POST['api_key'] ?? null;
    
    if ($providedKey !== API_KEY) {
        sendResponse(false, null, 'Invalid API key', 401);
    }
}

// Sanitize filename
function sanitizeFilename($filename) {
    $filename = preg_replace('/[^a-zA-Z0-9._-]/', '', $filename);
    $extension = pathinfo($filename, PATHINFO_EXTENSION);
    $basename = pathinfo($filename, PATHINFO_FILENAME);
    $basename = substr($basename, 0, 50); // Limit length
    return uniqid() . '_' . time() . '_' . $basename . '.' . $extension;
}

// Get file extension from mime type
function getExtensionFromMime($mimeType) {
    $mimeMap = [
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'video/mp4' => 'mp4',
        'video/mov' => 'mov',
        'video/avi' => 'avi',
        'video/webm' => 'webm',
        'audio/mpeg' => 'mp3',
        'audio/mp3' => 'mp3',
        'audio/wav' => 'wav',
        'audio/m4a' => 'm4a',
        'audio/aac' => 'aac',
        'audio/mp4' => 'm4a',
        'audio/x-m4a' => 'm4a',
        'audio/3gpp' => '3gp',
        'audio/x-caf' => 'caf',
    ];
    
    return $mimeMap[$mimeType] ?? 'bin';
}

// Validate file type
function validateFileType($mimeType, $type) {
    switch ($type) {
        case 'image':
            return in_array($mimeType, ALLOWED_IMAGE_TYPES);
        case 'video':
            return in_array($mimeType, ALLOWED_VIDEO_TYPES);
        case 'audio':
            return in_array($mimeType, ALLOWED_AUDIO_TYPES);
        default:
            return false;
    }
}

// Main upload handler
function handleUpload() {
    try {
        // Log request for debugging
        error_log("=== Upload Request Started ===");
        error_log("POST data: " . print_r($_POST, true));
        error_log("FILES data: " . print_r($_FILES, true));
        
        // Verify API key
        verifyApiKey();
        
        // Check if file was uploaded
        if (!isset($_FILES['file'])) {
            error_log("ERROR: No file uploaded");
            sendResponse(false, null, 'No file uploaded', 400);
        }
        
        $file = $_FILES['file'];
        $type = $_POST['type'] ?? 'image'; // image/video/audio
        $folder = $_POST['folder'] ?? 'general'; // Optional subfolder
        
        error_log("Upload type: $type, folder: $folder");
        
        // Check for upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors = [
                UPLOAD_ERR_INI_SIZE => 'File exceeds PHP upload_max_filesize',
                UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
                UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
                UPLOAD_ERR_NO_FILE => 'No file was uploaded',
                UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
                UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
                UPLOAD_ERR_EXTENSION => 'Upload stopped by extension',
            ];
            $errorMsg = $errors[$file['error']] ?? 'Unknown upload error';
            error_log("ERROR: Upload error - $errorMsg");
            sendResponse(false, null, $errorMsg, 400);
        }
        
        // Check file size
        if ($file['size'] > MAX_FILE_SIZE) {
            $msg = 'File size exceeds ' . (MAX_FILE_SIZE / 1024 / 1024) . 'MB limit';
            error_log("ERROR: $msg");
            sendResponse(false, null, $msg, 400);
        }
        
        // Get actual mime type using finfo (preferred) with fallback to file magic bytes
        $mimeType = null;
        
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $detectedMime = finfo_file($finfo, $file['tmp_name']);
                finfo_close($finfo);
                if ($detectedMime !== false) {
                    $mimeType = $detectedMime;
                }
            }
        }
        
        // Fallback 1: read file magic bytes manually
        if ($mimeType === null) {
            $fp = fopen($file['tmp_name'], 'rb');
            if ($fp !== false) {
                $header = fread($fp, 12);
                fclose($fp);
                // Check common image/video magic bytes
                if (substr($header, 0, 2) === "\xFF\xD8") {
                    $mimeType = 'image/jpeg';
                } elseif (substr($header, 0, 8) === "\x89PNG\r\n\x1a\n") {
                    $mimeType = 'image/png';
                } elseif (substr($header, 0, 6) === 'GIF87a' || substr($header, 0, 6) === 'GIF89a') {
                    $mimeType = 'image/gif';
                } elseif (strlen($header) >= 12 && substr($header, 0, 4) === 'RIFF' && substr($header, 8, 4) === 'WEBP') {
                    $mimeType = 'image/webp';
                } elseif (strlen($header) >= 12 && substr($header, 0, 4) === 'RIFF' && substr($header, 8, 4) === 'WAVE') {
                    $mimeType = 'audio/wav';
                } else {
                    // Last resort: trust the client-provided type (filtered below)
                    $mimeType = $file['type'];
                }
            }
        }
        
        // Final fallback: trust client-provided MIME type
        if ($mimeType === null || $mimeType === false || $mimeType === '') {
            $mimeType = $file['type'];
        }
        
        error_log("Detected MIME type: $mimeType");
        
        // Special handling for M4A files (often detected as video/mp4)
        // Check file extension to determine if it's actually audio
        $originalExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        error_log("Original extension: $originalExtension");
        
        if ($type === 'audio' && $mimeType === 'video/mp4' && in_array($originalExtension, ['m4a', 'aac', 'm4b'])) {
            // This is an M4A audio file, not a video file
            error_log("Converting video/mp4 to audio/mp4 for M4A file");
            $mimeType = 'audio/mp4'; // Use audio/mp4 for validation
        }
        
        // Validate file type
        if (!validateFileType($mimeType, $type)) {
            $msg = "Invalid file type. Expected $type, got $mimeType";
            error_log("ERROR: $msg");
            sendResponse(false, null, $msg, 400);
        }
        
        // Create folder structure
        $sanitizedFolder = preg_replace('/[^a-zA-Z0-9_-]/', '', $folder);
        $uploadPath = UPLOAD_DIR . $type . 's/' . $sanitizedFolder . '/';
        
        error_log("Upload path: $uploadPath");
        
        if (!is_dir($uploadPath)) {
            error_log("Creating directory: $uploadPath");
            if (!mkdir($uploadPath, 0755, true)) {
                error_log("ERROR: Failed to create upload directory");
                sendResponse(false, null, 'Failed to create upload directory', 500);
            }
        }
        
        // Generate unique filename
        $extension = getExtensionFromMime($mimeType);
        $filename = uniqid() . '_' . time() . '.' . $extension;
        $filePath = $uploadPath . $filename;
        
        error_log("Saving file to: $filePath");
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            error_log("ERROR: Failed to save file");
            sendResponse(false, null, 'Failed to save file', 500);
        }
        
        // Verify the file was saved and is non-empty
        if (!file_exists($filePath) || filesize($filePath) === 0) {
            error_log("ERROR: File saved but is empty or missing: $filePath");
            @unlink($filePath);
            sendResponse(false, null, 'File save verification failed', 500);
        }
        
        // Generate URL
        $fileUrl = BASE_URL . $type . 's/' . $sanitizedFolder . '/' . $filename;
        
        // Get file info
        $fileInfo = [
            'url' => $fileUrl,
            'filename' => $filename,
            'size' => $file['size'],
            'type' => $mimeType,
            'folder' => $sanitizedFolder,
            'uploaded_at' => date('Y-m-d H:i:s')
        ];
        
        error_log("Upload successful: $fileUrl");
        error_log("=== Upload Request Completed ===");
        
        // Optional: Log upload to database
        // logUploadToDatabase($fileInfo);
        
        sendResponse(true, $fileInfo);
    } catch (Exception $e) {
        error_log("EXCEPTION: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        sendResponse(false, null, 'Server error: ' . $e->getMessage(), 500);
    }
}

// Handle GET request (API info)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    sendResponse(true, [
        'message' => 'Hostinger Media Upload API',
        'version' => '1.0.0',
        'endpoints' => [
            'POST /upload.php' => 'Upload file (multipart/form-data)',
        ],
        'parameters' => [
            'file' => 'File to upload (required)',
            'type' => 'File type: image/video/audio (required)',
            'folder' => 'Subfolder name (optional)',
            'api_key' => 'API key for authentication (optional)',
        ],
        'max_file_size' => MAX_FILE_SIZE,
        'allowed_types' => [
            'image' => ALLOWED_IMAGE_TYPES,
            'video' => ALLOWED_VIDEO_TYPES,
            'audio' => ALLOWED_AUDIO_TYPES,
        ]
    ]);
}

// Handle POST request (file upload)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    handleUpload();
}

// Method not allowed
sendResponse(false, null, 'Method not allowed', 405);
