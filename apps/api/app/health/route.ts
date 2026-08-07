/**
 * Sonde de **vivacité** — pas de disponibilité. La distinction n'est pas
 * cosmétique : elle décide de ce qu'un orchestrateur fait de la réponse.
 *
 * Ce que cette route affirme : le processus est démarré et sert du HTTP.
 * Ce qu'elle **n'affirme pas** : que la base répond, que les services tiers sont
 * joignables, que l'application est prête à traiter une requête utile.
 *
 * ⚠️ Elle répondait `200` sans rien vérifier, et rien ne le disait. Un contrôle
 * qui ne peut pas échouer donne une assurance qu'il ne fournit pas : une
 * supervision branchée dessus resterait au vert pendant que la base est
 * injoignable. Relevé en audit le 2026-08-07 (D-055).
 *
 * **Pourquoi ne pas y ajouter la base ?** Parce qu'une sonde de vivacité qui
 * échoue fait *redémarrer* le processus. Si elle dépend de la base, une panne de
 * base déclenche une boucle de redémarrages qui aggrave l'incident au lieu de le
 * signaler. La dépendance se vérifie dans une sonde de **disponibilité**
 * distincte, à écrire le jour où un orchestrateur en consomme une — la graine
 * n'en a pas, et prétendre le contraire serait pire que l'absence.
 */
export const GET = (): Response =>
  new Response("OK", {
    status: 200,
    headers: {
      // Une réponse de sonde mise en cache ne prouve plus rien du moment présent.
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
  });
