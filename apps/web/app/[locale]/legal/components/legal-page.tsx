import { ArrowLeftIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import type { ReactNode } from "react";

interface LegalPageProperties {
  readonly children: ReactNode;
  readonly description: string;
  readonly title: string;
}

/**
 * Enveloppe commune aux pages légales, désormais statiques (D-031).
 *
 * Elles étaient servies par BaseHub. Le CMS a été retiré : ces pages changent
 * trois fois dans la vie d'un produit et n'avaient pas besoin d'un service
 * tiers, d'un jeton et d'une dépendance de build pour cela.
 */
export const LegalPage = ({
  title,
  description,
  children,
}: LegalPageProperties) => (
  <div className="container max-w-5xl py-16">
    <Link
      className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-sm focus:underline focus:outline-none"
      href="/"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Retour à l'accueil
    </Link>
    <h1 className="scroll-m-20 text-balance font-extrabold text-4xl tracking-tight lg:text-5xl">
      {title}
    </h1>
    <p className="text-balance leading-7 [&:not(:first-child)]:mt-6">
      {description}
    </p>
    <div className="prose prose-neutral dark:prose-invert mt-16">
      {children}
    </div>
  </div>
);

/**
 * Bandeau affiché tant que le texte n'a pas été rédigé et relu.
 *
 * Il est **volontairement visible** : une page légale non rédigée qui ressemble
 * à une page légale rédigée est pire que pas de page du tout — elle engage sans
 * que personne l'ait voulu.
 */
export const Placeholder = () => (
  <div className="not-prose mb-10 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
    <strong>Modèle non rédigé.</strong> Cette page décrit la structure attendue,
    pas un engagement. Le texte reste à écrire et à faire relire avant toute
    mise en service. Voir <code>docs/RISKS.md</code>, R-024.
  </div>
);
