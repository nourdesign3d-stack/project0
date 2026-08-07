import { describe, expect, test } from "vitest";
import { GET } from "../app/health/route";

/**
 * ⚠️ Ce test ne pouvait pas échouer autrement qu'en supprimant la route.
 *
 * Il vérifiait `status === 200` et `body === "OK"` — c'est-à-dire exactement les
 * deux constantes que la route écrit. Un test qui ne fait que relire ce que le
 * code vient d'écrire ne teste rien : c'est la même idée exprimée deux fois
 * (T-1402, 2026-08-07).
 *
 * Ce qui mérite d'être gardé ici n'est pas la valeur renvoyée, mais **la nature
 * de la sonde** : elle doit rester une sonde de **vivacité**, donc ne dépendre
 * d'aucune ressource externe. Une sonde de vivacité qui échoue fait *redémarrer*
 * le processus ; la faire dépendre de la base transformerait une panne de base
 * en boucle de redémarrages (D-055).
 *
 * Le jour où quelqu'un y ajoutera une requête, ce test échouera et demandera la
 * décision : est-ce bien une sonde de disponibilité qu'on veut, et sous quel
 * autre chemin ?
 */

describe("/health", () => {
  test("répond sans dépendre d'aucune ressource externe", () => {
    // Le module est importé sans qu'aucun accès base, réseau ou tiers ne soit
    // simulé. S'il en acquérait un, l'import ou l'appel lèverait ici.
    const response = GET();

    expect(response.status).toBe(200);
  });

  test("est synchrone : aucune attente d'entrée-sortie", () => {
    // Une sonde de vivacité qui attend quelque chose n'en est plus une. Le type
    // de retour le dit, mais un type ne s'exécute pas.
    const response = GET() as Response | Promise<Response>;

    expect(
      response instanceof Promise,
      "la sonde attend une entrée-sortie : ce n'est plus une sonde de vivacité"
    ).toBe(false);
  });

  test("ne se laisse pas mettre en cache", () => {
    // Une réponse de sonde mise en cache ne prouve plus rien du moment présent :
    // un intermédiaire pourrait servir un « OK » vieux de plusieurs minutes.
    expect(GET().headers.get("cache-control")).toContain("no-store");
  });
});
