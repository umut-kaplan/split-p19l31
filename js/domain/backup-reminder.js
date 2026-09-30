/* Erinnerung an ein Backup auf „Heute“. Reine Funktionen, per node --test geprüft.
   Einstellung in S.settings.backupRemindDays (7, 14, 30 oder 0 für aus),
   „Später“ in S.settings.backupSnoozedAt (Zeitpunkt des Tipps). */

export const REMIND_OPTIONS = [7, 14, 30, 0];
export const REMIND_DEFAULT = 7;
export const SNOOZE_DAYS = 2;
const DAY = 864e5;

/* Unbekannte Werte (alter Stand, kaputtes Backup) gelten als Standard */
export const remindEvery = v => (REMIND_OPTIONS.includes(v) ? v : REMIND_DEFAULT);

const filled = list => Array.isArray(list) && list.length > 0;
const values = obj => (obj && typeof obj === 'object' ? Object.values(obj) : []);

/* Gibt es etwas, das verloren gehen könnte? Trainings, Körper- und Aktivitätswerte, Essen oder Wasser.
   Profil und Plan allein zählen nicht, die sind nach der Einrichtung schnell wieder da. */
export function hasUserData(S) {
  if (!S) return false;
  if (filled(S.sessions)) return true;
  if (values(S.body).some(filled)) return true;
  if (values(S.activity).some(filled)) return true;
  if (values(S.nutrition && S.nutrition.log).some(filled)) return true;
  return values(S.water).some(ml => ml > 0);
}

/* Karte zeigen? Liefert null oder { days }: ganze Tage seit dem letzten Backup, null für „noch keins“.
   Fällig ab genau N Tagen, damit die Karte nie „vor 6 Tagen“ bei der Einstellung 7 zeigt. */
export function backupReminder(S, now = Date.now()) {
  const st = (S && S.settings) || {};
  const every = remindEvery(st.backupRemindDays);
  if (!every || !hasUserData(S)) return null;
  const snoozed = st.backupSnoozedAt;
  /* Ein „Später“ aus der Zukunft (Uhr verstellt) zählt nicht */
  if (typeof snoozed === 'number' && now >= snoozed && now - snoozed < SNOOZE_DAYS * DAY) return null;
  const last = st.lastBackup;
  if (typeof last === 'number' && last > 0) {
    const age = now - last;
    if (age < every * DAY) return null;
    return { days: Math.floor(age / DAY) };
  }
  return { days: null };
}

export function reminderText(r) {
  const lead = r.days == null ? 'Noch kein Backup.'
    : `Letztes Backup vor ${r.days === 1 ? 'einem Tag' : `${r.days} Tagen`}.`;
  return `${lead} Alles liegt nur auf diesem Handy.`;
}
