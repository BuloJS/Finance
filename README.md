# Compta — épargne mensuelle & annuelle

Interface web pour le suivi d'épargne mensuel : les colonnes du tableur d'origine
(Livret / PEA / PEL, Rentrée, Achats, Invest bonus potentiel, taux, cumuls),
douze lignes par année, saisie directe dans les cellules et sauvegarde automatique.

**Un seul fichier : `index.html`.** Aucune dépendance, aucun build, aucun serveur.
Ouvrez-le dans un navigateur (double-clic) et c'est prêt.

## Ce qui est saisi, ce qui est calculé

| Saisi | Calculé |
|---|---|
| **Base** (ce que vous décidez de mettre de côté) | Investissement |
| Livret, PEA, PEL (versements du mois) | Invest bonus potentiel |
| Rentrée, Achats (mouvements exceptionnels) | Cumul Livret / PEA / PEL |
| Taux Livret / PEA / PEL (annuels) | Total, Somme par an |

```
Invest bonus potentiel = Rentrée − Achats
Investissement = (Livret + PEA + PEL) + Invest bonus potentiel
Cumul = Cumul(m−1) × (1 + taux/12) + versement(m)
Total = Cumul Livret + Cumul PEA + Cumul PEL
Somme par an = cumul des versements depuis janvier
```

**Investissement, c'est ce que le mois a réellement mis de côté**, bonus compris.
Vert au-dessus de zéro, rouge en dessous : sous zéro, les achats exceptionnels ont
mangé plus que ce qui a été investi. Vous investissez 450 € et vos achats dépassent
vos rentrées de 600 € → l'Investissement du mois est de −150 €, en rouge.

L'*Invest bonus potentiel* est ce que les mouvements exceptionnels libèrent, ou
vous coûtent, en plus de la base. Il alimente directement la colonne
Investissement.

**Affecter une rentrée à une enveloppe.** La pastille `→` en bas de la case
Rentrée, toujours visible, ouvre le détail : une ligne par rentrée, chacune avec
une destination — Aucune, Livret, PEA ou PEL. Elle se lit d'un coup d'œil : `→`
seule quand rien n'est saisi, `→ affecter` dès qu'un montant n'a pas encore de
destination, `→ Livret` (ou `→ Livret+PEA`) une fois qu'il en a une. Le montant d'une ligne affectée
rejoint le **cumul** de son enveloppe et produit des intérêts avec elle ; une
rentrée de 800 € affectée au Livret fait passer le Cumul Livret de 700 à 1 500 €.
Une rentrée sans destination reste, comme avant, dans l'Invest bonus potentiel
seulement. Rien d'autre ne bouge : Investissement, bonus, jauge de la base et
graphique d'effort sont inchangés — l'argent n'est jamais compté deux fois —, et
la tuile « Intérêts » retranche les montants affectés pour ne pas les prendre pour
des gains.

La **Base** ne rentre pas dans ce calcul : c'est l'objectif que vous vous fixez,
suivi par la jauge « Base d'épargne » et par le repère posé sur chaque mois du
graphique d'effort. Une Base laissée vide vaut zéro.

Un résultat de zéro s'affiche `0 €`, pas `—` : c'est un résultat, pas une case
vide. Le tiret ne reste que sur les mois sans aucune saisie.

Les intérêts courent sur l'encours du mois précédent, le taux saisi étant annuel.
La ligne **Année** en bas du tableau totalise les versements et reprend les cumuls
de décembre.

> La troisième colonne de taux du tableur d'origine était intitulée « Taux PEA »
> (en double) ; elle est ici nommée **Taux PEL**, qui est visiblement ce qu'elle
> désignait.

## Saisie

- **Formats acceptés** : `1200`, `1 200,50`, `1200.5`, `-80`, avec ou sans `€` / `%`.
- **La base se recopie sur l'année entière** avec `Ctrl`/`Cmd`+`D` depuis janvier —
  et se corrige au cas par cas sur les mois qui sortent de l'ordinaire.
- **Un taux vaut pour les mois suivants** tant qu'un autre ne le remplace pas — il
  s'affiche en grisé sur les mois où il est hérité, et il se propage aussi d'une
  année sur l'autre.
- **Encours de départ** (panneau « Formules & paramètres ») : ce que contenait
  chaque enveloppe avant la première année. Les années suivantes reprennent
  automatiquement le solde de décembre.

### Années

Le `+` à droite des onglets ajoute l'année suivante. Le menu **Fichier** distingue
deux actions, chacune nommée d'après l'année affichée :

- **Vider l'année 2027** — efface les montants, l'année reste dans le tableau ;
- **Supprimer l'année 2027** — retire l'année entièrement (désactivé s'il n'en reste
  qu'une). Les cumuls des années suivantes se ré-enchaînent aussitôt sur l'année qui
  précède désormais.

### Raccourcis

| Touche | Effet |
|---|---|
| `↑` `↓` `Entrée` | Se déplacer d'une ligne |
| `Tab` | Cellule suivante |
| `Ctrl`/`Cmd` + `D` | Recopier la valeur vers tous les mois suivants |
| `Échap` | Annuler la saisie en cours |

## Données

Sauvegarde automatique dans le `localStorage` du navigateur — rien ne sort de la
machine. Chaque frappe est enregistrée, pas seulement à la sortie de la cellule.

Le menu **Fichier** permet d'exporter/importer le JSON complet (à faire de temps en
temps : vider les données du navigateur efface le `localStorage`) et d'exporter
l'année courante en CSV point-virgule avec BOM, qui s'ouvre directement dans Excel.

## Parti pris de design

- **Ledger d'abord.** Le tableau est le sujet, pas un composant parmi d'autres :
  en-tête et colonne Mois figées, lignes à 34 px, chiffres en chasse fixe alignés
  au caractère près. Les cellules calculées portent un voile discret et ne sont pas
  éditables.
- **Le code couleur du tableur est conservé** — vert Rentrée, rouge Achats, ambre
  Invest bonus — porté par les en-têtes, avec un rappel très atténué sur la colonne.
- **Accent indigo**, choisi pour ne pas entrer en conflit avec ces trois couleurs
  qui, elles, portent du sens.
- **Rythme trimestriel** : un filet plus marqué après mars, juin, septembre et
  décembre.
- **Thème clair et sombre**, alignés sur le réglage système par défaut, avec bascule
  manuelle. Les couleurs des graphiques sont validées pour les deux fonds et pour
  les daltonismes deutan/protan/tritan.

## Ajouter un graphique

Les deux graphiques existants (`drawWealth`, `drawEffort`) suivent le même contrat
et servent de modèle :

1. Lire les données depuis `view.lines[m]` — chaque ligne expose `deposits`,
   `cumuls`, `rates`, `reste`, `rentree`, `achats`, `bonus`, `total`, `annee` ;
   `view.sum` porte les totaux de l'année.
2. Prendre les couleurs de série dans `ENVELOPES[].color` (`--s1` `--s2` `--s3`),
   jamais en dur — c'est ce qui garde les deux thèmes cohérents.
3. Ajouter un `<div class="panel">` dans `<section class="charts">` et appeler la
   fonction de dessin depuis `render()`.

`niceScale()`, `svgEl()`, `renderLegend()`, `makeTooltip()` et `positionTip()` sont
déjà disponibles.
