# lbc-notifier

Surveille les nouvelles annonces Leboncoin correspondant à `SSD 500Go` et les envoie sur Telegram.

## Configuration

```sh
cp .env.example .env
```

Renseignez le jeton du bot et l’identifiant du chat dans `.env`. Les réglages de recherche sont dans `src/constant.ts` : requête, intervalle et nombre d’annonces.

Au premier lancement, les annonces déjà présentes sont enregistrées sans notification. Passez `notifyInitialResults` à `true` pour les recevoir.

## Exécution

```sh
bun install
bun start
```

Le fichier `data/seen-ads.json` conserve les annonces déjà traitées.
