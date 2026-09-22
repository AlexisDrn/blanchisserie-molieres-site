# Déploiement sur Render — nouvelle version avec back office serveur

Ce projet remplace l'ancienne version (un seul fichier `index.html` publié via GitHub) par un vrai petit serveur. Le back office (`/admin`) enregistre désormais directement ses modifications sur le serveur, dans un fichier `content.json` stocké sur un disque persistant. Il n'y a plus besoin de jeton GitHub ni de republier manuellement le fichier : cliquer sur "Publier les modifications" dans le back office suffit.

## Ce que contient le projet

```
server.js                 -> le serveur (sert le site public et l'API du back office)
package.json              -> dépendances (Express, cookie-parser)
index.template.html       -> le site, avec 3 emplacements que le serveur remplit automatiquement
data/content.seed.json    -> le contenu de départ (galerie, tarifs, articles actuels)
admin/index.html          -> le back office (page servie sur /admin)
render.yaml               -> configuration de déploiement Render (Blueprint)
```

Le contenu réellement utilisé en production sera stocké dans `data/content.json`, créé automatiquement au premier démarrage à partir de `content.seed.json`, puis mis à jour à chaque publication depuis le back office. Ce fichier vit sur le disque persistant Render, pas dans le dépôt GitHub.

## Étape 1 — Remplacer le contenu du dépôt GitHub

Le dépôt `AlexisDrn/blanchisserie-molieres-site` ne contient aujourd'hui qu'un `index.html`. Il faut le remplacer par l'ensemble des fichiers ci-dessus (en gardant la même racine de dépôt) :

1. Supprimer l'ancien `index.html` à la racine du dépôt (ou le déplacer, peu importe, il ne sera plus utilisé par le serveur).
2. Ajouter tous les fichiers listés ci-dessus à la racine du dépôt, en conservant l'arborescence (`data/content.seed.json`, `admin/index.html`, etc.).
3. Committer et pousser sur `main`, comme d'habitude.

Comme d'habitude également, si le push depuis ton PC ne fonctionne pas (identifiants GitHub non enregistrés), le plus simple reste d'utiliser l'interface web de GitHub ("Add file" → "Upload files") pour déposer les fichiers.

## Étape 2 — Créer le service Render

Comme tu as déjà un abonnement Render, deux façons de procéder :

**Option A — via le Blueprint (`render.yaml`), le plus simple**
1. Dans le tableau de bord Render, "New" → "Blueprint".
2. Sélectionner le dépôt `blanchisserie-molieres-site`.
3. Render détecte `render.yaml` et propose de créer le service web + le disque persistant automatiquement. Valider.

**Option B — création manuelle**
1. "New" → "Web Service", sélectionner le dépôt.
2. Runtime : Node. Build command : `npm install`. Start command : `npm start`.
3. Plan : au minimum "Starter" (le plan gratuit ne permet pas d'avoir de disque persistant, indispensable ici).
4. Dans l'onglet "Disks" du service, ajouter un disque : chemin de montage `/data`, taille 1 Go (largement suffisant).

Dans les deux cas, il faut ensuite définir les variables d'environnement (onglet "Environment") :

- `ADMIN_PASSWORD` : le mot de passe que tu utiliseras pour te connecter au back office. À choisir toi-même et à définir manuellement (Render ne le génère pas).
- `SESSION_SECRET` : générée automatiquement par Render via le Blueprint ; sinon, en création manuelle, mets n'importe quelle longue chaîne aléatoire (30 caractères ou plus).
- `DATA_DIR` : `/data` (déjà inclus dans le Blueprint).

Une fois déployé, Render donne une URL du type `https://blanchisserie-molieres.onrender.com`. C'est cette adresse qui doit être utilisée comme domaine public du site (ou reliée à ton nom de domaine existant si tu en as un, via les réglages "Custom Domain" de Render).

## Étape 3 — Premier accès

- Site public : `https://<ton-service>.onrender.com/`
- Back office : `https://<ton-service>.onrender.com/admin`

Se connecter au back office avec le mot de passe défini dans `ADMIN_PASSWORD`. Le contenu affiché au départ est celui du site actuel (galerie, tarifs, articles), repris automatiquement depuis `content.seed.json`.

## Utilisation au quotidien

- Toute modification de la galerie, des tarifs ou des articles se fait désormais entièrement dans `/admin`, puis en cliquant sur **"Publier les modifications"**. Le changement est visible sur le site public immédiatement, sans redéploiement ni intervention sur GitHub.
- Le bouton **"Recharger depuis le serveur"** permet de récupérer la dernière version enregistrée (utile si quelqu'un d'autre a publié une modification entre-temps).
- Le mot de passe du back office peut être changé à tout moment en modifiant la variable `ADMIN_PASSWORD` dans Render (le service redémarre automatiquement).
- **Git et GitHub ne servent plus qu'aux évolutions techniques du site** (nouvelle mise en page, nouvelle fonctionnalité, correction de bug) — jamais aux mises à jour de contenu courantes.

## Donner l'accès à un client (ou une autre personne)

Comme il n'y a plus de jeton à transmettre, donner accès au back office à quelqu'un d'autre revient simplement à lui communiquer :
- l'adresse `/admin`,
- le mot de passe (`ADMIN_PASSWORD`).

Cela fonctionne depuis n'importe quel ordinateur ou navigateur, sans rien installer.

## En cas de problème

- **Le site affiche une erreur au démarrage / le back office reste bloqué sur "connexion"** : vérifier dans les logs Render que `ADMIN_PASSWORD` et `SESSION_SECRET` sont bien définies (le serveur refuse les connexions tant que ce n'est pas le cas, et l'écrit clairement dans les logs).
- **Une modification publiée a disparu après un redéploiement** : cela signifierait que le disque persistant n'est pas correctement monté sur `/data` — à vérifier dans l'onglet "Disks" du service Render.
- **Mot de passe oublié** : le changer directement dans les variables d'environnement Render, pas besoin d'accéder au back office pour cela.
