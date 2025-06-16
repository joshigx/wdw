<?php
// Begrüßungsseite - greeting.php

// URL-Pfad analysieren
$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);

// Den Namen aus dem Pfad extrahieren
// Erwartetes Format: /hallo/{name}
$pathParts = explode('/', trim($path, '/'));

// Prüfen ob der Pfad das richtige Format hat
if (count($pathParts) >= 2 && $pathParts[0] === 'hallo') {
    $name = $pathParts[1];
    
    // Name bereinigen (XSS-Schutz)
    $name = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
    
    // Ersten Buchstaben großschreiben
    $name = ucfirst(strtolower($name));
    
    $greeting = "Hallo " . $name;
} else {
    // Fallback wenn kein Name angegeben wurde
    $greeting = "Hallo! Bitte gib deinen Namen in der URL an: /hallo/{dein-name}";
}
?>

<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Begrüßung</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
        }
        
        .greeting-container {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 40px 60px;
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .greeting {
            font-size: 3em;
            font-weight: bold;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .subtitle {
            font-size: 1.2em;
            opacity: 0.8;
        }
        
        .info {
            margin-top: 30px;
            font-size: 0.9em;
            opacity: 0.7;
            font-style: italic;
        }
        
        @media (max-width: 768px) {
            .greeting {
                font-size: 2em;
            }
            .greeting-container {
                padding: 30px 40px;
                margin: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="greeting-container">
        <div class="greeting">
            <?php echo $greeting; ?>
        </div>
        
        <?php if (isset($name)): ?>
            <div class="subtitle">
                Schön, dich kennenzulernen!
            </div>
        <?php endif; ?>
        
        <div class="info">
            <?php if (!isset($name)): ?>
                Beispiel: <?php echo $_SERVER['HTTP_HOST']; ?>/hallo/josua
            <?php else: ?>
                URL: <?php echo $_SERVER['HTTP_HOST'] . $requestUri; ?>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>