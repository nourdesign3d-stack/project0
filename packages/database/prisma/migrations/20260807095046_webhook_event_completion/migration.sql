-- Distinguer « réservé » de « terminé », et rendre la purge indexée.
--
-- Migration **expand** au sens de `.claude/rules/database.md` : elle n'ajoute
-- que du nullable et un index. Aucune donnée n'est réécrite, aucune colonne
-- supprimée. Elle peut donc être appliquée **avant** le code qui l'utilise, et
-- le code d'avant continue de fonctionner sans elle — c'est ce qui rend le
-- retour arrière possible sans perte.
--
-- `completedAt` NULL sur les lignes existantes signifie « réservé, issue
-- inconnue ». C'est la valeur juste : on ne sait pas si ces traitements ont
-- abouti, et prétendre le contraire les rendrait à tort non rejouables.
-- Conséquence assumée : les lignes antérieures à cette migration deviendront
-- rejouables une fois passé le délai de reprise. Sur une graine sans trafic
-- réel, c'est sans effet.
--
-- L'index sur `receivedAt` n'est pas décoratif : la purge par ancienneté et la
-- reprise des réservations abandonnées le balaient toutes deux. Sans lui, les
-- deux parcourent la table entière à chaque passage, et le coût croît avec le
-- volume — exactement là où l'on veut qu'il reste constant.
--
-- Voir D-049.

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");
