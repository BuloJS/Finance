/**
 * sync.js — synchronisation des données entre PC via Supabase.
 *
 * Le tableau vivait jusqu'ici dans le seul localStorage du navigateur, donc
 * sur un seul PC. Il est désormais recopié dans la table `user_data` du
 * projet partagé (colonne `app` = "finance"), lisible depuis n'importe quel
 * poste une fois connecté sur la page d'accueil.
 *
 * Le localStorage reste la source de vérité immédiate : l'application
 * démarre et s'enregistre sans attendre le réseau, et la synchronisation se
 * fait par-dessus. Couper le réseau ne bloque donc rien.
 *
 * Écrit avec `fetch` plutôt qu'avec la librairie officielle : deux requêtes
 * suffisent, autant ne pas embarquer 100 Ko de dépendance ni dépendre d'un
 * CDN joignable.
 *
 * Arbitrage en cas de divergence : la version portant l'horodatage le plus
 * récent gagne. Suffisant pour un usage personnel, où les deux côtés sont
 * rarement modifiés en même temps.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, PROJECT_REF, APP_NAME } from "./config.js";

const SESSION_KEY = `sb-${PROJECT_REF}-auth-token`;
const REST = `${SUPABASE_URL}/rest/v1/user_data`;

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.currentSession ?? parsed ?? null;
  } catch {
    return null;
  }
}

function headers(session) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

/** Clé sous laquelle l'application range son état dans le localStorage. */
const STORAGE_KEY = "compta.epargne.v1";

/**
 * Ramène ce qui est stocké côté serveur à la forme attendue par
 * l'application, et refuse ce qui n'y ressemble pas.
 *
 * Deux formes circulent :
 *  - l'état lui-même, reconnaissable à sa propriété `years` ;
 *  - une copie brute du localStorage, `{"compta.epargne.v1": "{…}"}`,
 *    produite par la procédure de reprise des données. C'est le cas qui a
 *    fait repartir l'application sur un tableau vide : elle ne reconnaissait
 *    pas l'enveloppe et retombait sur l'état par défaut.
 *
 * Renvoyer null plutôt qu'un état vide est essentiel : l'appelant conserve
 * alors les données locales au lieu de les écraser.
 */
function normalize(data) {
  if (!data || typeof data !== "object") return null;
  if (data.years) return data;

  const wrapped = data[STORAGE_KEY];
  if (typeof wrapped === "string") {
    try {
      const parsed = JSON.parse(wrapped);
      if (parsed?.years) return parsed;
    } catch {
      return null;
    }
  }
  if (wrapped?.years) return wrapped;

  return null;
}

/**
 * Un état contient-il quelque chose ? Sert de garde-fou : un tableau vide ne
 * doit jamais remplacer un tableau rempli, même s'il porte un horodatage
 * plus récent. C'est exactement ce qui a fait disparaître des données —
 * un état par défaut, bien formé mais vide, a écrasé la sauvegarde.
 */
function hasContent(state) {
  if (!state?.years) return false;

  const opening = state.opening || {};
  if (["livret", "pea", "pel"].some((k) => Number(opening[k]) > 0)) return true;

  return Object.values(state.years).some((year) =>
    (year?.rows || []).some((row) =>
      ["base", "rentree", "achats", "livret", "pea", "pel"].some(
        (k) => row?.[k] !== null && row?.[k] !== undefined && row?.[k] !== ""
      )
    )
  );
}

/** Données enregistrées côté serveur, ou null si le compte n'en a pas encore. */
async function fetchRemote(session) {
  const url = `${REST}?app=eq.${encodeURIComponent(APP_NAME)}&select=data,updated_at`;
  const response = await fetch(url, { headers: headers(session) });

  if (!response.ok) {
    throw new Error(`lecture refusée (${response.status})`);
  }
  const rows = await response.json();
  if (!rows.length) return null;

  const state = normalize(rows[0].data);
  if (!state) return { state: null, updatedAt: Date.parse(rows[0].updated_at) || 0 };

  return { state, updatedAt: Date.parse(rows[0].updated_at) || 0 };
}

/** Écrit (ou remplace) les données du compte connecté. */
async function pushRemote(session, state, updatedAt) {
  const response = await fetch(REST, {
    method: "POST",
    headers: { ...headers(session), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([
      {
        user_id: session.user.id,
        app: APP_NAME,
        data: state,
        updated_at: new Date(updatedAt).toISOString(),
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(`enregistrement refusé (${response.status})`);
  }
}

// --- Branchement sur l'application ----------------------------------------

const session = readSession();
const app = window.__financeApp;

// Sans session ou sans application (page ouverte hors contexte), on ne fait
// rien : la garde a déjà renvoyé vers la page d'accueil.
if (session?.access_token && session.user?.id && app) {
  let pending = null;

  /** Envoi différé, pour ne pas écrire à chaque frappe. */
  function schedulePush(state, updatedAt) {
    if (pending) clearTimeout(pending);
    pending = setTimeout(async () => {
      pending = null;
      try {
        await pushRemote(session, state, updatedAt);
        app.onSyncState("ok");
      } catch (error) {
        app.onSyncState("error", error.message);
      }
    }, 1200);
  }

  window.__financeSync = { push: schedulePush };

  // Au démarrage : on compare ce qu'a le serveur et ce qu'a ce PC.
  (async () => {
    try {
      const remote = await fetchRemote(session);
      const local = app.getLocalStamp();

      if (remote && remote.state && !hasContent(remote.state) && hasContent(app.getState())) {
        // Le serveur est vide alors que ce PC a des données : on ne les
        // remplace pas, on remet plutôt le serveur à jour.
        schedulePush(app.getState(), Date.now());
        app.onSyncState("pushed-over-empty");
      } else if (remote && remote.state === null) {
        // Le serveur contient quelque chose d'illisible pour l'application.
        // On n'y touche pas et on garde les données locales : écraser l'un
        // ou l'autre ferait perdre des données pour de bon.
        app.onSyncState("error", "données serveur non reconnues, non modifiées");
      } else if (remote && remote.updatedAt > local) {
        app.applyRemoteState(remote.state);
        app.onSyncState("pulled");
      } else if (!remote || local > remote.updatedAt) {
        // Ce PC est en avance (ou le serveur est vide) : on le met à jour.
        schedulePush(app.getState(), local || Date.now());
      } else {
        app.onSyncState("ok");
      }
    } catch (error) {
      app.onSyncState("error", error.message);
    }
  })();
}
