<?php
/**
 * Прокси OpenRouter для shared-хостинга (Рег.ру и др. с PHP + curl).
 *
 * Настройка токена (любой один способ):
 * 1) Переменные окружения в панели хостинга: Token или SARAN_OPENROUTER_TOKEN
 * 2) Файл рядом: openrouter-token.txt (не коммитить; см. api/.htaccess)
 * 3) Файл: openrouter-token.local.php который делает <?php return 'sk-or-…';
 *
 * Требования: включён модуль curl, исходящие HTTPS запросы не заблокированы.
 */
declare(strict_types=1);

header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST', true);
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'method_not_allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$token =
    getenv('Token') ?:
    getenv('SARAN_OPENROUTER_TOKEN') ?:
    getenv('TOKEN') ?:
    '';

$tokenPathTxt = __DIR__ . DIRECTORY_SEPARATOR . 'openrouter-token.txt';
if ($token === '' || $token === false) {
    if (is_readable($tokenPathTxt)) {
        $token = trim((string)file_get_contents($tokenPathTxt));
    }
}

$tokenPathPhp = __DIR__ . DIRECTORY_SEPARATOR . 'openrouter-token.local.php';
if (($token === '' || $token === false) && is_readable($tokenPathPhp)) {
    /**
     * @var mixed $__t
     */
    $__t = include $tokenPathPhp;
    if (is_string($__t)) {
        $token = trim($__t);
    }
}

$token = is_string($token) ? trim($token) : '';
if ($token === '') {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'server_token_missing'], JSON_UNESCAPED_UNICODE);
    exit;
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false || $rawBody === '') {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'empty_body'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $payload = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'bad_json'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (!is_array($payload)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'bad_payload'], JSON_UNESCAPED_UNICODE);
    exit;
}

$messages = $payload['messages'] ?? null;
if (!is_array($messages) || count($messages) === 0) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'messages_required'], JSON_UNESCAPED_UNICODE);
    exit;
}

$model = getenv('SARAN_OPENROUTER_MODEL');
$model = is_string($model) ? trim($model) : '';
if ($model === '' && isset($payload['model']) && is_string($payload['model'])) {
    $model = trim($payload['model']);
}
if ($model === '') {
    $model = 'google/gemma-3-12b-it';
}

$forwardPayload = [
    'model' => $model,
    'messages' => $messages,
];
if (isset($payload['temperature']) && is_numeric($payload['temperature'])) {
    $forwardPayload['temperature'] = (float)$payload['temperature'];
}
if (isset($payload['max_tokens']) && is_numeric($payload['max_tokens'])) {
    $forwardPayload['max_tokens'] = (int)$payload['max_tokens'];
}
if (isset($payload['stream'])) {
    $forwardPayload['stream'] = (bool)$payload['stream'];
}
try {
    $rawBody = json_encode($forwardPayload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'encode_failed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$origin = '';
if (!empty($_SERVER['HTTP_ORIGIN']) && is_string($_SERVER['HTTP_ORIGIN'])) {
    $origin = $_SERVER['HTTP_ORIGIN'];
} elseif (!empty($_SERVER['HTTP_REFERER']) && is_string($_SERVER['HTTP_REFERER'])) {
    $parsed = parse_url($_SERVER['HTTP_REFERER']);
    if ($parsed && isset($parsed['scheme'], $parsed['host'])) {
        $origin = $parsed['scheme'] . '://' . $parsed['host'];
    }
}
if ($origin === '') {
    $origin = 'https://saran.local';
}

$upstream = 'https://openrouter.ai/api/v1/chat/completions';

if (!function_exists('curl_init')) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'curl_missing'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ch = curl_init($upstream);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 20,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $token,
        'HTTP-Referer: ' . $origin,
        'X-Title: Saran Chat Proxy'
    ],
    CURLOPT_POSTFIELDS => $rawBody,
]);

$response = curl_exec($ch);
if ($response === false) {
    $curlErr = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'curl_failed',
        'message' => $curlErr,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$ctype = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if ($ctype) {
    header('Content-Type: ' . $ctype);
} else {
    header('Content-Type: application/json; charset=utf-8');
}

if ($code > 0) {
    http_response_code($code);
} else {
    http_response_code(502);
}

echo $response;
