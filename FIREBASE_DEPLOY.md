# Déploiement Firebase Hosting

Ton app est prête. Voici comment la mettre en ligne en 5 minutes.

## 1. Installer la CLI Firebase (une seule fois sur ton PC)

```bash
npm install -g firebase-tools
firebase login
```

## 2. Lier le projet local au projet Firebase

Dans le dossier du projet :

```bash
firebase use --add
# choisis "planning-lovable" et donne-lui l'alias "default"
```

## 3. Déployer les règles de sécurité Firestore (IMPORTANT, à faire une fois)

```bash
firebase deploy --only firestore:rules
```

> Sans ces règles, ta base est ouverte ou bloquée. Le fichier `firestore.rules` à la racine fait déjà tout : agents = leurs données, admins = tout.

## 4. Créer le premier compte admin

1. Console Firebase → **Authentication → Users → Add user** : entre ton email + mot de passe.
2. **Firestore → Start collection** → ID de la collection : `users` → ID du document : **colle l'UID** de l'utilisateur que tu viens de créer (visible dans Authentication).
3. Champs à mettre dans ce document :
   - `prenom` (string) : ton prénom
   - `nom` (string) : ton nom
   - `role` (string) : `admin`
   - `email` (string) : ton email
4. Connecte-toi à l'app — tu es admin. Les utilisateurs suivants peuvent être créés depuis la page **Utilisateurs**.

## 5. Builder et déployer l'app

```bash
npm run build
firebase deploy --only hosting
```

L'URL publique s'affiche à la fin (ex: `https://planning-lovable.web.app`).

## Mises à jour suivantes

Après chaque modif :

```bash
npm run build && firebase deploy --only hosting
```

## Mode hors ligne

Le cache Firestore (IndexedDB) est déjà activé dans `src/lib/firebase.ts`. L'app reste fonctionnelle hors ligne — les écritures sont synchronisées dès la reconnexion.

## Notes importantes

- **Suppression d'utilisateur** : depuis la page Utilisateurs, on supprime uniquement le profil Firestore. Le compte Auth doit être supprimé manuellement dans la console Firebase (suppression d'auth nécessite l'Admin SDK).
- **Création d'utilisateur via la page Utilisateurs** : Firebase reconnecte automatiquement le nouvel utilisateur. L'admin doit donc se reconnecter ensuite. Pour éviter ça en production, il faudrait passer par une Cloud Function.
