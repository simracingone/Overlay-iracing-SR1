## [6.0.1] - 2026-11-11

### Corrigé
- Le compagnon Team-Voix utilise Edge TTS 7.3.1 pour corriger l'échec HTTP 403 de l'ancienne version.
- L'état du moteur audio est signalé et les erreurs du service vocal sont consignées.
- La fenêtre Team est agrandie, sans barre de défilement, et son en-tête sert de poignée de déplacement en mode édition.
- Chaque projet utilise un cache Electron distinct.
- L'installation principale prépare aussi les dépendances de Team-Voix ; ses lanceurs restent séparés.
- La fenêtre Team reste visible au repos, démarre même si l'API principale est absente et propose un raccourci de test audio.
- Le déplacement de la fenêtre est accessible par `Ctrl + Alt + M`, avec l'ancien raccourci F11 conservé.
- Le test vocal est maintenant relié à la fenêtre Team et disponible par `Ctrl + Alt + T`.
- Version du compagnon Team-Voix : 1.0.3.

## [6.0.0] - 2026-11-07

### Séparation des projets
- Le projet principal contient les HUD et la télémétrie, sans le serveur ni les annonces vocales.
- Le nouveau projet `Team-Voix` contient la fenêtre Radio Team, le service vocal, les photos et les sons radio.
- Les annonces gardent leurs déclencheurs existants et lisent le flux local du projet principal.
- L'installation principale prépare les deux projets ; les lanceurs permettent de démarrer et fermer les voix séparément.

## [5.2.1] - 2026-11-04

### Corrigé
- Le lancement ne ferme plus les processus Python ou Electron d'autres applications.
- Les serveurs locaux sont vérifiés avant l'ouverture de l'interface et arrêtés à sa fermeture.
- L'API vocale limite les origines web, la taille des messages et la file d'attente.
- L'installation n'exige plus de droits administrateur et ne modifie plus le pare-feu.
- Les dépendances Python sont définies dans `requirements.txt` et Node se réinstalle avec `npm ci`.
- Si Python manque, `install.bat` installe Python 3.12 pour l'utilisateur via WinGet.
- Les instructions et la version affichée sont harmonisées.

## [3.2.1] - 2026-01-29

### 🇫🇷 Français
#### Corrigé
- **HUD Radio** : Le panneau des experts de l'équipe s'affiche désormais correctement à l'écran lorsqu'un message audio est diffusé.
- **Visibilité** : Correction d'un conflit entre l'état de visibilité par défaut (sauvegardé dans le localStorage) et le déclenchement dynamique des messages. Le module force maintenant son apparition lors de la prise de parole.
- **Synchronisation** : Amélioration de la fluidité entre l'API TTS et l'affichage visuel pour éviter que le texte ne disparaisse trop tôt.

---

### 🇺🇸 English
#### Fixed
- **Radio HUD**: The team expert panel now correctly displays on-screen whenever an audio message is broadcasted.
- **Visibility**: Fixed a conflict between the default visibility state (stored in localStorage) and dynamic message triggering. The module now forces itself to be visible during speech.
- **Synchronization**: Improved timing between the TTS API and the visual UI to ensure the text remains visible throughout the audio playback.
