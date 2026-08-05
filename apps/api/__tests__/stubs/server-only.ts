// `server-only` lève dès qu'il est importé hors d'un contexte serveur React.
// Sans cette substitution, aucun package serveur ne peut être chargé en test, et
// il faudrait simuler chacun d'eux — y compris le code que l'on veut éprouver.
// C'est ainsi que le webhook Stripe est resté sans test : sa vérification de
// signature n'était pas atteignable autrement qu'en la simulant, donc en ne la
// testant pas.
export {};
