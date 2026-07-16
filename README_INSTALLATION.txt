ELMS — application hors ligne de scan QR

CONTENU
- index.html
- styles.css
- app.js
- service-worker.js
- manifest.json
- icon.svg
- centres.json

MISE EN LIGNE SUR GITHUB PAGES
1. Crée un nouveau dépôt GitHub public.
2. Téléverse tous les fichiers de ce dossier à la racine du dépôt.
3. Ouvre Settings > Pages.
4. Choisis Deploy from a branch.
5. Sélectionne main et / (root).
6. Enregistre.
7. Attends la publication de l'URL GitHub Pages.
8. Ouvre l'URL une première fois avec Internet.
9. Autorise la caméra et le GPS.
10. Actualise la page une seconde fois.

FONCTIONNEMENT HORS LIGNE
- Le référentiel centres.json est enregistré dans IndexedDB.
- L'interface et la bibliothèque de scan sont mises en cache.
- Tous les scans sont enregistrés localement dans IndexedDB.
- Les scans peuvent être exportés en CSV ou JSON.
- La synchronisation vers Google Sheets sera ajoutée lors de l'intégration backend.

CONTRÔLE GPS
- Jusqu'à 300 m : CONFORME
- 301 à 600 m : À VÉRIFIER
- Plus de 600 m : IRRÉGULARITÉ POSSIBLE
- Coordonnées officielles absentes : GPS_REFERENCE_MANQUANT

IMPORTANT
- Chaque téléphone doit ouvrir l'application au moins une fois avec Internet.
- Ne supprime pas les données du site pendant la mission avant export ou synchronisation.
