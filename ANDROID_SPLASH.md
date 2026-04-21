# Splash screen natif Android (Capacitor)

Le splash natif est configuré via `@capacitor/splash-screen` et apparaît **avant** le chargement de la WebView (plus aucun écran blanc au démarrage).

## 1. Première installation locale (à faire une seule fois)

```bash
git pull
npm install
npx cap add android
npx cap update android
npm run build
npx cap sync android
```

## 2. Générer le splash natif (logo CDPNT centré sur fond rouge)

Le logo source est dans `src/assets/logo.jpeg`. Pour générer les ressources Android natives (drawable `splash.png` + icônes), utilise [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets) :

```bash
npm install --save-dev @capacitor/assets

# Crée le dossier 'assets' à la racine et copie ton logo dedans
mkdir -p assets
cp src/assets/logo.jpeg assets/splash.png
cp src/assets/logo.jpeg assets/icon.png

npx capacitor-assets generate --android \
  --splashBackgroundColor "#C8102E" \
  --splashBackgroundColorDark "#C8102E"
```

Cela crée automatiquement :
- `android/app/src/main/res/drawable*/splash.png`
- les icônes adaptive
- le bon `colors.xml`

## 3. Vérifier `styles.xml` et `AndroidManifest.xml`

Capacitor ajoute déjà un thème `AppTheme.NoActionBarLaunch` qui utilise `@drawable/splash`. Vérifie dans :

`android/app/src/main/res/values/styles.xml` :
```xml
<style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
    <item name="android:background">@drawable/splash</item>
</style>
```

`android/app/src/main/AndroidManifest.xml` (sur l'activité principale) :
```xml
<activity
    android:theme="@style/AppTheme.NoActionBarLaunch"
    ...>
```

## 4. Lancer sur émulateur / appareil

```bash
npm run build && npx cap sync android
npx cap run android
```

## Notes
- Le splash natif disparaît automatiquement dès que React est monté (voir `src/main.tsx`) avec un fadeOut de 300ms → pas de flash blanc.
- `launchShowDuration: 2000` est juste une **sécurité max** ; en pratique le splash se masque dès que l'app est prête.
- Après chaque `git pull`, refaire : `npm install && npm run build && npx cap sync android`.
