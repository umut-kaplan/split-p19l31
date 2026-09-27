export function bmi(kg, cm) {
  if (!(kg > 0 && cm > 0)) return null;
  const m = cm / 100;
  return kg / (m * m);
}

/* Einteilung der WHO für Erwachsene */
export function bmiCategory(b) {
  if (b == null) return null;
  if (b < 18.5) return 'Untergewicht';
  if (b < 25) return 'Normalgewicht';
  if (b < 30) return 'Übergewicht';
  return 'Adipositas';
}

/* Position auf der Skala 15 bis 35 in Prozent, für die Markierung */
export function bmiScalePos(b) {
  if (b == null) return null;
  return Math.max(0, Math.min(100, (b - 15) / 20 * 100));
}

/* Das zuletzt eingetragene Gewicht, sonst der Wert aus dem Profil */
export function currentWeight(profile, weights) {
  if (weights && weights.length) {
    const last = [...weights].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).pop();
    return last.kg;
  }
  return profile.weightKg || null;
}
