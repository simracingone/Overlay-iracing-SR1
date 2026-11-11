# SimracingOne — Team Voice 1.0.3

Projet compagnon séparé pour la fenêtre Radio Team et les annonces vocales. Il peut être fermé sans fermer les overlays ou le serveur de télémétrie du projet principal.

## Démarrage

1. Depuis le dossier principal, lancez une fois `install.bat` pour préparer les deux projets.
2. Lancez `start.bat` dans le dossier principal pour les HUD et la télémétrie, puis `Team-Voix\start.bat` pour les voix. Team-Voix peut aussi démarrer seul : il affiche alors son état et se reconnecte à la télémétrie quand le projet principal démarre.

Le projet Team Voice se connecte au flux iRacing du projet principal sur `127.0.0.1:8000`. Il démarre son service vocal sur `127.0.0.1:5000`, ou choisit automatiquement un autre port local libre si le port 5000 est occupé. Fermer la fenêtre Team Voice arrête seulement son service vocal et cette fenêtre.

L’indicateur en haut à droite montre séparément l’état de la télémétrie et du moteur audio. En cas de panne audio, les détails sont consignés dans `voice-server.log` et `voice-server-error.log` dans ce dossier.

## Contrôles

- `Ctrl + Alt + M` : activer/désactiver le mode déplacement. Une fois activé, faire glisser l’en-tête. L’ancien raccourci `Ctrl + Alt + Maj + F11` reste disponible.
- `Ctrl + Alt + T` : lancer une phrase de test audio, même sans session iRacing. `Ctrl + Alt + Maj + F10` reste disponible en raccourci secondaire.
- `Ctrl + Alt + Maj + F12` : fermer le projet Team Voice.
- `Alt + F4` : fermer sa fenêtre.

## Messages annoncés

Les annonces sont déclenchées par les événements, pas par une lecture en continu. Le panneau reste affiché même lorsqu’il n’y a pas de message.

- **Drapeaux et pénalités** : départ au vert, drapeaux jaune/bleu/à damier, pénalité de coupe et drapeau noir-orange. Les messages dépendent du type de séance.
- **Course** : changement de position, voiture proche devant ou derrière, puis résultat final (victoire, podium, top 10 ou classement).
- **Entraînement** : premier tour, meilleur tour, amélioration du delta, voiture à rattraper, position de tête ou podium.
- **Piste et météo** : hausse/baisse notable de température, début/fin de pluie et vent fort en course.
- **Stratégie et pilotage** : réserve de carburant faible, surconsommation, écart au meilleur tour, incidents répétés et rythme qui ralentit.

Certaines alertes sont limitées par un délai de repos, qui varie selon le type d’annonce.

## Dépendances et confidentialité

Les dépendances Electron et Python sont installées dans ce dossier. L'installateur ajoute Node.js dans le profil Windows de l'utilisateur si nécessaire. Si Python manque, il peut installer Python 3.12 pour le compte Windows courant avec WinGet ; WinGet doit donc être disponible dans ce cas.

Les messages vocaux sont générés avec Edge TTS et nécessitent Internet. Le texte des annonces est transmis au service en ligne Edge TTS de Microsoft. Les détails figurent dans `notice securite.txt`.
