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

/** Données enregistrées côté serveur, ou null si le compte n'en a pas encore. */
async function fetchRemote(session) {
  const url = `${REST}?app=eq.${encodeURIComponent(APP_NAME)}&select=data,updated_at`;
  const response = await fetch(url, { headers: headers(session) });

  if (!response.ok) {
    throw new Error(`lecture refusée (${response.status})`);
  }
  const rows = await response.json();
  if (!rows.length) return null;

  return { state: rows[0].data, updatedAt: Date.parse(rows[0].updated_at) || 0 };
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

      if (remote && remote.updatedAt > local) {
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
