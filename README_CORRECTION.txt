CORRECTIF APP.JS — VERSION 1.2

Cause exacte :
La fonction calculateGpsStatus() n'était pas fermée par une accolade avant
la déclaration de la fonction haversine(). Cette erreur de syntaxe empêchait
tout le fichier app.js de s'exécuter. L'application restait donc bloquée sur
« Initialisation… » et le compteur des centres restait vide.

À faire sur GitHub :
1. Supprimer uniquement l'ancien fichier app.js.
2. Téléverser directement le nouveau fichier app.js fourni ici.
3. Faire Commit changes.
4. Attendre 1 à 3 minutes.
5. Effacer les données du site GitHub Pages dans le navigateur.
6. Recharger https://manno10.github.io/logistique/

Résultat attendu :
1395 centres du référentiel.
