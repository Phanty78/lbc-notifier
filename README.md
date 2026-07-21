# lbc-notifier

Surveille les nouvelles annonces Leboncoin correspondant à une recherche et les envoie sur Telegram. Pensé pour traquer les bons plans (ex. SSD 500 Go) sans spam : seules les annonces **nouvelles** et **disponibles** sont notifiées.

## Configuration

```sh
cp .env.example .env
```

Renseignez les variables dans `.env` :

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Jeton du bot Telegram (via [@BotFather](https://t.me/BotFather)) |
| `TELEGRAM_CHAT_ID` | Identifiant du chat/destinataire des notifications |
| `DATABASE_URL` | Connection string Postgres Supabase (`postgresql://postgres:[PASSWORD]@db.<project>.supabase.co:5432/postgres`) |

### Setup Supabase (gratuit)

Les annonces déjà vues sont stockées dans Postgres (Supabase free tier) plutôt que sur disque, ce qui rend le service stateless et déployable sur n’importe quel host (PaaS gratis inclus, FS éphémère OK).

1. Créez un projet sur [supabase.com](https://supabase.com) (free tier).
2. Dans le **SQL editor**, exécutez [`supabase/schema.sql`](supabase/schema.sql) :
   ```sql
   create table if not exists public.seen_ads (
     id bigint primary key,
     first_seen_at timestamptz not null default now()
   );
   ```
3. Récupérez la **connection string** dans *Project Settings → Database → Connection string → URI*. Remplacez `[YOUR-PASSWORD]` par le mot de passe base de données (si oublié : *Reset database password* dans la même page). Les caractères spéciaux du mot de passe doivent être percent-encodés dans l’URL.

> Connexion directe (user `postgres` = superuser) : bypass RLS, le service est le seul à y accéder. Ne committez jamais le mot de passe.

## Exécution

```sh
bun install
bun start
```

Les annonces déjà traitées sont conservées dans la table Supabase `seen_ads`.

## Réglages de recherche

Tous les réglages sont dans `src/constant.ts` :

```ts
export const SEARCH = {
  query: "SSD 500Go",
  category: Category.ELECTRONIQUE_ACCESSOIRES_INFORMATIQUE,
  priceMin: 0,
  priceMax: 40,
  excludeReserved: true,
  intervalMs: 60_000,
  limit: 100,
  notifyInitialResults: false,
} as const;
```

### Options

| Option | Type | Description |
|---|---|---|
| `query` | `string` | Texte de recherche Leboncoin. |
| `category` | `Category` | Catégorie restreinte. Ici `ELECTRONIQUE_ACCESSOIRES_INFORMATIQUE` pour cibler les SSD seuls (exclut les PC complets). Voir les valeurs dans `@maeldonnart/lbc-ts` (`Category.*`). Mettre `Category.TOUTES_CATEGORIES` pour toutes catégories. |
| `priceMin` | `number` | Prix minimum en euros (filtre API). |
| `priceMax` | `number` | Prix maximum en euros (filtre API). LBC ne renvoie que les annonces dans `[priceMin, priceMax]`. |
| `excludeReserved` | `boolean` | `true` exclut les annonces vendues ou en cours de vente (attribut Leboncoin `transaction_status` = `Vendu` ou `Achat en cours`). Filtre côté client : l’API renvoie quand même ces annonces, elles sont retirées après réception. |
| `intervalMs` | `number` | Intervalle entre deux recherches, en millisecondes. |
| `limit` | `number` | Nombre d’annonces demandées par recherche (max 100). Comme `excludeReserved` filtre après réception, augmenter `limit` augmente aussi le nombre d’annonces réellement disponibles remontées. |
| `notifyInitialResults` | `boolean` | `false` (défaut) : au premier lancement, les annonces déjà en ligne sont enregistrées comme vues **sans** notification. `true` : elles sont notifiées aussi. |

### Bon à savoir

- **Au premier lancement**, les annonces déjà présentes sont enregistrées sans notification (sauf `notifyInitialResults: true`). Pour recevoir les annonces existantes une fois, basculez `notifyInitialResults: true`, lancez une fois, puis remettez `false`.
- **Annonces vendues** : Leboncoin garde les annonces vendues au statut `active` ; le signal fiable est l’attribut `transaction_status`. `excludeReserved` s’appuie dessus.
- **Filtre prix** : natif côté API LBC (range), contrairement à `excludeReserved` qui est un post-filtre client.

## Développement

```sh
bun run check      # biome + tsc
bun run check:fix  # biome --write
```