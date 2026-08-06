import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { LegalPage, Placeholder } from "../components/legal-page";

const title = "Politique de confidentialité";
const description =
  "Quelles données nous traitons, pourquoi, combien de temps, et comment exercer vos droits.";

export const metadata: Metadata = createMetadata({ title, description });

const Privacy = () => (
  <LegalPage description={description} title={title}>
    <Placeholder />

    <h2>Responsable du traitement</h2>
    <p>Identité, adresse et contact de l'entité responsable — à compléter.</p>

    <h2>Données traitées</h2>
    <p>
      À compléter à partir de <code>docs/DATA_DICTIONARY.md</code>, qui recense
      les données réellement manipulées. Ne rien déclarer ici qui n'y figure
      pas, et n'omettre aucune donnée qui y figure.
    </p>

    <h2>Finalités et bases légales</h2>
    <p>
      Pour chaque catégorie de données : à quoi elle sert, et sur quel fondement
      juridique elle est traitée.
    </p>

    <h2>Destinataires</h2>
    <p>
      Les services tiers qui reçoivent des données doivent être nommés. À ce
      jour, la graine transmet à Clerk (authentification), Sentry et BetterStack
      (observabilité), Stripe (paiement). Cette liste doit refléter les services
      réellement activés, pas ceux qui sont câblés.
    </p>

    <h2>Durée de conservation</h2>
    <p>Par catégorie de données — à compléter.</p>

    <h2>Vos droits</h2>
    <p>
      Accès, rectification, effacement, opposition, portabilité, et la procédure
      concrète pour les exercer.
    </p>

    <h2>Contact</h2>
    <p>Adresse à laquelle une demande peut être adressée — à compléter.</p>
  </LegalPage>
);

export default Privacy;
