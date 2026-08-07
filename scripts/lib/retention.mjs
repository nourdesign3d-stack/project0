/**
 * Politique de rétention des sauvegardes, isolée de tout accès disque pour
 * qu'elle soit **testable sans fabriquer de fichiers**.
 *
 * Règle décidée le 2026-08-07 (`docs/RECOVERY.md`, D-059) :
 *
 *  - toutes les sauvegardes des **30 derniers jours** sont conservées ;
 *  - au-delà, on garde **la plus ancienne de chaque mois**, pendant 12 mois ;
 *  - le reste est supprimé.
 *
 * « La plus ancienne du mois » plutôt que la plus récente : c'est celle qui
 * précède les changements du mois, donc celle vers laquelle on veut revenir
 * quand on découvre qu'une régression date de plusieurs semaines.
 *
 * ⚠️ La fonction ne supprime **jamais** la sauvegarde la plus récente, quelle
 * que soit son ancienneté. Si l'automatisation s'arrête pendant deux mois, la
 * rétention ne doit pas achever le travail en effaçant la dernière copie
 * existante — c'est le moment où elle compte le plus.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 30;
const MONTHLY_KEPT = 12;

/** Clé `AAAA-MM` d'un instant, pour regrouper par mois calendaire. */
const monthKey = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * @param {{ name: string, date: Date }[]} backups
 * @param {Date} now
 * @returns {{ keep: string[], remove: string[] }}
 */
export const applyRetention = (backups, now) => {
  if (backups.length === 0) {
    return { keep: [], remove: [] };
  }

  const sorted = [...backups].sort((a, b) => b.date - a.date);
  const newest = sorted[0].name;
  const recentThreshold = new Date(now.getTime() - RECENT_DAYS * DAY_MS);

  const keep = new Set([newest]);
  const monthlySeen = new Map();

  for (const backup of sorted) {
    if (backup.date >= recentThreshold) {
      keep.add(backup.name);
      continue;
    }

    // Plus ancienne du mois : on parcourt du plus récent au plus ancien, donc
    // la dernière vue pour un mois donné est la plus ancienne.
    monthlySeen.set(monthKey(backup.date), backup.name);
  }

  for (const name of [...monthlySeen.values()].slice(0, MONTHLY_KEPT)) {
    keep.add(name);
  }

  return {
    keep: sorted.filter((b) => keep.has(b.name)).map((b) => b.name),
    remove: sorted.filter((b) => !keep.has(b.name)).map((b) => b.name),
  };
};

/**
 * Horodatage porté par le nom d'un fichier produit par `db:backup`
 * (`2026-08-07T12-30-00.dump`). Renvoie `null` si le nom ne suit pas la
 * convention — un fichier étranger au dossier ne doit jamais être supprimé.
 */
const STAMPED = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})\.dump$/;

export const dateFromName = (name) => {
  const match = name.match(STAMPED);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  );

  return Number.isNaN(date.getTime()) ? null : date;
};
