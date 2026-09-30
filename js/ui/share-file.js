/* Datei weitergeben: über das Teilen-Menü (auf dem iPhone „In Dateien sichern“), sonst als Download.
   Muss direkt aus einem Tipp heraus laufen, sonst verweigert Safari das Teilen-Menü.
   Das Ergebnis (Promise) sagt, wie belastbar das Speichern ist:
   'shared'     Teilen-Menü abgeschlossen
   'cancelled'  Teilen-Menü abgebrochen
   'failed'     Teilen-Menü hat einen Fehler gemeldet
   'downloaded' Download angestoßen; ob die Datei ankommt, meldet der Browser nicht
   'unsure'     Download angestoßen, aber dieser Browser speichert so meist nichts */

/* Home-Bildschirm-Apps auf älteren iPhones (ohne Teilen von Dateien) laden per Link nichts herunter */
const downloadLikely = () => 'download' in HTMLAnchorElement.prototype && navigator.standalone !== true;

export function shareFile(data, name, type, title) {
  let file = null;
  try { file = new File([data], name, { type }); } catch (e) { /* alter Browser */ }
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title })
      .then(() => 'shared', e => (e && e.name === 'AbortError' ? 'cancelled' : 'failed'));
  }
  const url = URL.createObjectURL(file || new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return Promise.resolve(downloadLikely() ? 'downloaded' : 'unsure');
}

export const SHARE_FAILED = 'Das Teilen-Menü ließ sich nicht öffnen. Versuch es noch einmal.';
