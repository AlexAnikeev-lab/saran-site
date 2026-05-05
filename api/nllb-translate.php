<?php
/**
 * Прокси перевода на бурятский (NLLB).
 *
 * Режимы (первый доступный):
 * 1) Свой VPS: переменная SARAN_NLLB_SELF_HOST_URL → POST …/translate (см. каталог nllb-server/)
 * 2) Hugging Face Inference API (токен обязателен только в этом режиме)
 *
 * POST JSON: { "text": "…", "source_lang": "eng_Latn", "target_lang": "bury_Cyrl" }
 * Ответ 200: { "translated_text": "…", "model": "…" }
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

$rawBody = file_get_contents('php://input');
if ($rawBody === false || $rawBody === '') {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'empty_body'], JSON_UNESCAPED_UNICODE);
    exit;
}

$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'bad_json'], JSON_UNESCAPED_UNICODE);
    exit;
}

$text = isset($payload['text']) ? trim((string)$payload['text']) : '';
if ($text === '') {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'empty_text'], JSON_UNESCAPED_UNICODE);
    exit;
}

$src = isset($payload['source_lang']) ? trim((string)$payload['source_lang']) : 'eng_Latn';
$tgt = isset($payload['target_lang']) ? trim((string)$payload['target_lang']) : 'bury_Cyrl';
if ($src === '' || $tgt === '') {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'bad_lang'], JSON_UNESCAPED_UNICODE);
    exit;
}

$maxChars = 8000;
if (function_exists('mb_strlen') && function_exists('mb_substr')) {
    if (mb_strlen($text, 'UTF-8') > $maxChars) {
        $text = mb_substr($text, 0, $maxChars, 'UTF-8');
    }
} elseif (strlen($text) > $maxChars) {
    $text = substr($text, 0, $maxChars);
}

if (!function_exists('curl_init')) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'curl_missing'], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * @param mixed $decoded
 */
function saran_extract_self_host_translation($decoded): string
{
    if (!is_array($decoded)) {
        return '';
    }
    if (isset($decoded['translated_text'])) {
        return trim((string)$decoded['translated_text']);
    }
    return '';
}

$selfBase = getenv('SARAN_NLLB_SELF_HOST_URL');
$selfBase = is_string($selfBase) ? trim($selfBase) : '';
if ($selfBase !== '') {
    $selfBase = rtrim($selfBase, '/');
    $selfUrl = $selfBase . '/translate';
    try {
        $forwardJson = json_encode(
            [
                'text' => $text,
                'source_lang' => $src,
                'target_lang' => $tgt,
            ],
            JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );
    } catch (Throwable $e) {
        http_response_code(400);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'encode_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $headers = ['Content-Type: application/json'];
    $shKey = getenv('SARAN_NLLB_SELF_HOST_API_KEY');
    if (is_string($shKey) && trim($shKey) !== '') {
        $headers[] = 'X-API-Key: ' . trim($shKey);
    }

    $ch = curl_init($selfUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 25,
        CURLOPT_TIMEOUT => 180,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $forwardJson,
    ]);
    $response = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($response !== false && $code === 200) {
        try {
            $dec = json_decode((string)$response, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable $e) {
            http_response_code(502);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'bad_upstream_json'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $out = saran_extract_self_host_translation($dec);
        if ($out !== '') {
            $mid = isset($dec['model']) && is_string($dec['model']) ? $dec['model'] : 'self-hosted';
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(200);
            echo json_encode([
                'translated_text' => $out,
                'model' => $mid,
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    http_response_code($code >= 400 && $code <= 599 ? $code : 502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'self_host_failed',
        'http' => $code,
        'detail' => $response !== false && strlen((string)$response) <= 500
            ? (string)$response
            : ($response !== false ? substr((string)$response, 0, 500) : ''),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Hugging Face Inference API ---
$token =
    getenv('SARAN_HF_TOKEN') ?:
    getenv('HF_TOKEN') ?:
    getenv('HUGGINGFACE_HUB_TOKEN') ?:
    '';

$tokenPathTxt = __DIR__ . DIRECTORY_SEPARATOR . 'hf-token.txt';
if ($token === '' || $token === false) {
    if (is_readable($tokenPathTxt)) {
        $token = trim((string)file_get_contents($tokenPathTxt));
    }
}

$tokenPathPhp = __DIR__ . DIRECTORY_SEPARATOR . 'hf-token.local.php';
if (($token === '' || $token === false) && is_readable($tokenPathPhp)) {
    /** @var mixed $__ht */
    $__ht = include $tokenPathPhp;
    if (is_string($__ht)) {
        $token = trim($__ht);
    }
}

$token = is_string($token) ? trim($token) : '';
if ($token === '') {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'server_hf_token_missing'], JSON_UNESCAPED_UNICODE);
    exit;
}

$model = getenv('SARAN_NLLB_HF_MODEL');
$model = is_string($model) && trim($model) !== '' ? trim($model) : '';
if ($model === '' && !empty($payload['model']) && is_string($payload['model'])) {
    $model = trim($payload['model']);
}
if ($model === '') {
    $model = 'facebook/nllb-200-distilled-600M';
}
if (!preg_match('#^[a-zA-Z0-9][a-zA-Z0-9._/-]*$#', $model) || strpos($model, '..') !== false) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'bad_model'], JSON_UNESCAPED_UNICODE);
    exit;
}

$upstream = 'https://api-inference.huggingface.co/models/' . $model;

$bodyArr = [
    'inputs' => $text,
    'parameters' => [
        'src_lang' => $src,
        'tgt_lang' => $tgt,
    ],
];
try {
    $bodyJson = json_encode($bodyArr, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'encode_failed'], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * @return array{code:int,body:string}
 */
function saran_hf_inference_post(string $url, string $token, string $bodyJson): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 25,
        CURLOPT_TIMEOUT => 180,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $token,
        ],
        CURLOPT_POSTFIELDS => $bodyJson,
    ]);
    $response = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($response === false) {
        return ['code' => 0, 'body' => ''];
    }
    return ['code' => $code, 'body' => (string)$response];
}

/**
 * @param mixed $decoded
 */
function saran_extract_translation($decoded): string
{
    if (is_string($decoded)) {
        return trim($decoded);
    }
    if (!is_array($decoded)) {
        return '';
    }
    if (isset($decoded[0]) && is_array($decoded[0]) && isset($decoded[0]['translation_text'])) {
        return trim((string)$decoded[0]['translation_text']);
    }
    if (isset($decoded['translation_text'])) {
        return trim((string)$decoded['translation_text']);
    }
    return '';
}

$lastBody = '';
$out = '';
$http = 0;
for ($attempt = 0; $attempt < 3; $attempt++) {
    if ($attempt > 0) {
        sleep($attempt === 1 ? 10 : 20);
    }
    $r = saran_hf_inference_post($upstream, $token, $bodyJson);
    $lastBody = $r['body'];
    $http = $r['code'];
    if ($http === 200) {
        try {
            $dec = json_decode($lastBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable $e) {
            http_response_code(502);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'bad_upstream_json'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        if (is_array($dec) && isset($dec['error'])) {
            $out = '';
        } else {
            $out = saran_extract_translation($dec);
        }
        if ($out !== '') {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(200);
            echo json_encode([
                'translated_text' => $out,
                'model' => $model,
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    if ($http !== 503 && $http !== 429) {
        break;
    }
}

http_response_code($http >= 400 && $http <= 599 ? $http : 502);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'error' => 'translation_failed',
    'http' => $http,
    'detail' => strlen($lastBody) > 400 ? substr($lastBody, 0, 400) : $lastBody,
], JSON_UNESCAPED_UNICODE);
