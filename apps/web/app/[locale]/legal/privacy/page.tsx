import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { LegalPage, Placeholder } from "../components/legal-page";

const title = "Politique de confidentialité";
const description =
  "Quelles données nous traitons, pourquoi, combien de temps, et comment exercer vos droits.";

export const metadata: Metadata = createMetadata({ title, description });

/**
 * Ce qui est écrit ici est **factuel**, et vérifiable dans le dépôt : la liste
 * des destinataires vient des fichiers `keys.ts` de chaque package, les
 * catégories de données de `docs/DATA_DICTIONARY.md`, les durées de
 * `docs/RECOVERY.md`.
 *
 * Ce qui reste à compléter — identité de l'éditeur, finalités métier, bases
 * légales — dépend du produit et de l'entité qui l'exploite. Ne pas le deviner.
 *
 * ⚠️ Aucun de ces textes n'a été relu par un juriste. Le bandeau reste affiché
 * jusque-là (R-024).
 */
const Privacy = () => (
  <LegalPage description={description} title={title}>
    <Placeholder />

    <h2>Responsable du traitement</h2>
    <p>
      <strong>À compléter</strong> : raison sociale, forme juridique, adresse du
      siège, numéro d'immatriculation et adresse de contact de l'entité qui
      exploite le service.
    </p>

    <h2>Données traitées</h2>
    <p>
      Le service traite les catégories suivantes. Elles correspondent à ce que
      le code manipule réellement — voir <code>docs/DATA_DICTIONARY.md</code>,
      tenu à jour et vérifié automatiquement.
    </p>
    <ul>
      <li>
        <strong>Identité et authentification</strong> — adresse e-mail, nom,
        photo de profil, appartenance à une organisation et rôle. Détenues par
        Clerk, notre fournisseur d'identité ; le service ne les recopie pas dans
        sa propre base.
      </li>
      <li>
        <strong>Facturation</strong> — moyens de paiement et factures, détenus
        par Stripe. Aucun numéro de carte ne transite par nos serveurs ni n'y
        est stocké.
      </li>
      <li>
        <strong>Mesure d'audience</strong> — pages consultées et interactions,
        rattachées à un <em>identifiant pseudonyme</em>. Ni adresse e-mail, ni
        nom, ni numéro de téléphone ne sont transmis à l'outil de mesure.
      </li>
      <li>
        <strong>Diagnostic technique</strong> — erreurs et traces d'exécution.
        Les corps de requête, en-têtes, cookies et paramètres d'URL en sont
        retirés avant envoi.
      </li>
      <li>
        <strong>Données techniques de traitement</strong> — identifiants de
        livraison des notifications reçues de nos prestataires, conservés pour
        éviter qu'un même événement soit traité deux fois.
      </li>
    </ul>

    <h2>Finalités et bases légales</h2>
    <p>
      <strong>À compléter</strong> pour les traitements liés aux fonctionnalités
      du service, qui ne sont pas encore définies. Les traitements techniques
      ci-dessus reposent sur l'exécution du contrat (authentification,
      facturation) et sur l'intérêt légitime à assurer la sécurité et le bon
      fonctionnement du service (diagnostic, idempotence).
    </p>

    <h2>Destinataires</h2>
    <p>
      Les prestataires suivants reçoivent des données dans le cadre du service.
      Cette liste correspond aux services <em>réellement activés</em> ; un
      service dont les clés ne sont pas renseignées ne reçoit rien.
    </p>
    <ul>
      <li>
        <strong>Clerk</strong> — authentification et gestion des organisations.
      </li>
      <li>
        <strong>Stripe</strong> — paiement et facturation.
      </li>
      <li>
        <strong>PostHog</strong> — mesure d'audience. Reçoit un identifiant
        pseudonyme et une date de création de compte, jamais d'identifiant
        direct. Le trafic transite par notre propre domaine.
      </li>
      <li>
        <strong>Sentry</strong> — signalement des erreurs techniques.
      </li>
      <li>
        <strong>BetterStack</strong> — journaux applicatifs et supervision de
        disponibilité, lorsqu'ils sont activés.
      </li>
      <li>
        <strong>Resend</strong> — envoi des messages transactionnels et du
        formulaire de contact.
      </li>
      <li>
        <strong>Hébergeur de la base de données et de l'application</strong> —{" "}
        <strong>à compléter</strong> : nom, pays d'hébergement.
      </li>
    </ul>

    <h2>Durée de conservation</h2>
    <ul>
      <li>
        <strong>Compte et identité</strong> — pendant la durée du compte ; leur
        suppression relève du fournisseur d'identité.
      </li>
      <li>
        <strong>Données techniques de traitement</strong> — 30 jours après
        traitement, purge automatique quotidienne. Les traitements n'ayant pas
        abouti sont conservés au-delà, pour examen.
      </li>
      <li>
        <strong>Sauvegardes de la base</strong> — 30 jours glissants, plus une
        sauvegarde mensuelle conservée 12 mois. Une donnée supprimée subsiste
        donc dans les sauvegardes jusqu'à l'expiration de ces délais.
      </li>
      <li>
        <strong>Mesure d'audience et diagnostic</strong> —{" "}
        <strong>à compléter</strong> : durées fixées dans la configuration de
        chaque prestataire.
      </li>
    </ul>

    <h2>Vos droits</h2>
    <p>
      Vous disposez d'un droit d'accès, de rectification, d'effacement,
      d'opposition, de limitation et de portabilité, ainsi que du droit
      d'introduire une réclamation auprès de l'autorité de contrôle compétente.
    </p>
    <p>
      <strong>À compléter</strong> : la procédure concrète pour les exercer, et
      le délai de réponse. ⚠️ L'effacement doit couvrir les données détenues par
      les prestataires ci-dessus, pas seulement notre base : cette chaîne doit
      être écrite et vérifiée avant toute mise en service.
    </p>

    <h2>Cookies et traceurs</h2>
    <p>
      <strong>À compléter</strong> : inventaire des cookies réellement déposés,
      leur finalité, leur durée, et le mécanisme de recueil du consentement pour
      ceux qui ne sont pas strictement nécessaires — la mesure d'audience en
      fait partie.
    </p>

    <h2>Contact</h2>
    <p>
      <strong>À compléter</strong> : adresse à laquelle une demande relative aux
      données personnelles peut être adressée.
    </p>
  </LegalPage>
);

export default Privacy;
