import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { LegalPage, Placeholder } from "../components/legal-page";

const title = "Conditions d'utilisation";
const description =
  "Ce que le service fournit, ce qu'il attend de vous, et ce qui se passe en cas de manquement.";

export const metadata: Metadata = createMetadata({ title, description });

const Terms = () => (
  <LegalPage description={description} title={title}>
    <Placeholder />

    <h2>Objet</h2>
    <p>Ce que le service fournit, et à qui — à compléter.</p>

    <h2>Compte et accès</h2>
    <p>
      Conditions de création, responsabilité des identifiants, cas de
      suspension.
    </p>

    <h2>Tarifs et facturation</h2>
    <p>
      Prix, périodicité, reconduction, résiliation, remboursement. À aligner sur
      ce qui est réellement implémenté — voir <code>docs/DECISIONS.md</code>,
      D-029.
    </p>

    <h2>Usages interdits</h2>
    <p>Ce qui entraîne une suspension, et selon quelle procédure.</p>

    <h2>Disponibilité</h2>
    <p>
      Engagement de disponibilité s'il y en a un. ⚠️ Ne rien promettre ici qui ne
      soit mesuré : aucune politique de sauvegarde n'est arrêtée à ce jour
      (R-004), et un engagement de reprise sans procédure éprouvée est un
      engagement qu'on ne tiendra pas.
    </p>

    <h2>Responsabilité</h2>
    <p>Limites, exclusions — à faire relire.</p>

    <h2>Droit applicable</h2>
    <p>Juridiction compétente — à compléter.</p>
  </LegalPage>
);

export default Terms;
