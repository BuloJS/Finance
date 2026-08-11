// Coordonnées du compte unique, partagé avec Home, Series et Simu-SCI.
//
// Aucune clé secrète ici : Finance ne fait que lire la session déposée par
// Home dans le localStorage de l'origine commune. La référence du projet sert
// uniquement à retrouver la bonne clé de stockage.

export const PROJECT_REF = "pyduueytagmzsdwtzltu";

// Page d'accueil, vers laquelle renvoyer si aucune session valide n'est trouvée.
export const HOME_PATH = "/Home/";

// Exiger que la double authentification ait été franchie (niveau « aal2 »).
// Sans cela, une session arrêtée à l'étape du code à 6 chiffres sur Home —
// donc ouverte avec le mot de passe seul — suffirait à entrer ici.
// À passer à false uniquement si la 2FA est retirée du compte.
export const REQUIRE_AAL2 = true;
