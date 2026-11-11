# SimracingOne Overlay — v6.0.1

Projet principal de l'overlay iRacing pour Windows. Il conserve les HUD et le serveur de télémétrie, sans la Radio Team ni les annonces vocales.

## Installation et lancement

1. Lancez une seule fois `install.bat` en utilisateur normal. Il prépare les dépendances des deux projets. Node.js est installé dans le profil Windows si nécessaire ; si Python manque, Python 3.12 est installé pour le compte courant via WinGet.
2. Lancez `start.bat` pour ouvrir les HUD et le serveur de télémétrie. Lancez `Team-Voix\start.bat` séparément pour les voix.

## Projet Radio Team séparé

Le compagnon `Team-Voix` contient la fenêtre Team, les annonces vocales, leurs images et effets radio. L'installation principale prépare aussi ce compagnon. Vous pouvez démarrer ou fermer Team-Voix séparément ; les HUD iRacing continuent de tourner.

Le compagnon lit le flux local du projet principal sur `127.0.0.1:8000` et choisit un port local libre pour son service vocal si le port habituel `5000` est occupé. La génération TTS nécessite Internet et transmet le texte des annonces à Edge TTS de Microsoft. Voir `Team-Voix\README.md` et `Team-Voix\notice securite.txt`.

Si Python n'est pas déjà installé, WinGet doit être disponible pour que l'installateur l'ajoute automatiquement.

## Raccourcis du projet principal

- `Ctrl + Alt + F4` : HUD2
- `Ctrl + Alt + F6` : météo, piste et drapeaux
- `Ctrl + Alt + F7` : télémétrie voiture
- `Ctrl + Alt + F8` : tableau de bord
- `Ctrl + Alt + F9` : menu de visibilité
- `Ctrl + Alt + F10` : réinitialisation des positions
- `Ctrl + Alt + F11` : gestion des pilotes
- `Ctrl + Alt + F12` : mode édition

## Licence

L'usage commercial nécessite l'autorisation écrite de SimracingOne.
