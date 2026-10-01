/* Wissen-Karten: kurz erklärt, worauf die Vorschläge der App beruhen. Grundlage ist die Recherche vom 30.09.2026.
   evidence 'belegt': So steht es in Studien oder Leitlinien. 'abgeleitet': übertragen aus Studien zu verwandten Fragen,
   zum Beispiel vom Nachtschlaf auf den Tagschlaf nach der Nachtschicht.
   Allgemein formuliert, ohne Heil- oder Leistungsversprechen und ohne Dosierung für Nahrungsergänzung (App Store 1.4.1).
   Die ids sind stabil: knowledgeLink(id) in js/views/knowledge.js verweist von anderen Seiten darauf. */

export const KNOWLEDGE_GROUPS = [
  ['schicht', 'Schicht und Schlaf'],
  ['ernaehrung', 'Ernährung'],
  ['training', 'Training'],
];

export const EVIDENCE_LABEL = {
  belegt: 'Gut belegt',
  abgeleitet: 'Abgeleitet aus Studien zu verwandten Fragen',
};

const doi = (label, d) => ({ label, url: `https://doi.org/${d}` });

const SRC = {
  grgic: doi('Grgic et al. 2019, Chronobiology International (Metaanalyse)', '10.1080/07420528.2019.1567524'),
  bruggisser: doi('Bruggisser et al. 2023, Sports Medicine – Open (Metaanalyse)', '10.1186/s40798-023-00577-5'),
  facerChilds: doi('Facer-Childs et al. 2018, Sports Medicine – Open', '10.1186/s40798-018-0162-z'),
  craven: doi('Craven et al. 2022, Sports Medicine (Metaanalyse)', '10.1007/s40279-022-01706-y'),
  knowles: doi('Knowles et al. 2018, Journal of Science and Medicine in Sport', '10.1016/j.jsams.2018.01.012'),
  shriane: doi('Shriane et al. 2023, Sleep (Expertenkonsens für Schichtarbeitende)', '10.1093/sleep/zsad182'),
  watson: doi('Watson et al. 2015, Journal of Clinical Sleep Medicine (Konsens AASM/SRS)', '10.5664/jcsm.4758'),
  ingre: doi('Ingre et al. 2008, Chronobiology International', '10.1080/07420520802110704'),
  frimpong: doi('Frimpong et al. 2021, Sleep Medicine Reviews (Metaanalyse)', '10.1016/j.smrv.2021.101535'),
  stutz: doi('Stutz et al. 2019, Sports Medicine (Metaanalyse)', '10.1007/s40279-018-1015-0'),
  gardiner23: doi('Gardiner et al. 2023, Sleep Medicine Reviews (Metaanalyse)', '10.1016/j.smrv.2023.101764'),
  gardiner25: doi('Gardiner et al. 2025, Sleep (randomisierte Studie)', '10.1093/sleep/zsae230'),
  chellappa: doi('Chellappa et al. 2021, Science Advances', '10.1126/sciadv.abg9910'),
  morton: doi('Morton et al. 2018, British Journal of Sports Medicine (Metaanalyse)', '10.1136/bjsports-2017-097608'),
  reis: doi('Reis et al. 2021, Journal of Science and Medicine in Sport (Übersichtsarbeit)', '10.1016/j.jsams.2020.07.016'),
  kreider: doi('Kreider et al. 2017, Journal of the International Society of Sports Nutrition (Position der ISSN)', '10.1186/s12970-017-0173-z'),
  antonio: doi('Antonio et al. 2021, Journal of the International Society of Sports Nutrition', '10.1186/s12970-021-00412-w'),
  murphy: doi('Murphy und Koehler 2022, Scandinavian Journal of Medicine & Science in Sports (Metaanalyse)', '10.1111/sms.14075'),
  garthe: doi('Garthe et al. 2011, International Journal of Sport Nutrition and Exercise Metabolism', '10.1123/ijsnem.21.2.97'),
  pelland: doi('Pelland et al. 2025, Sports Medicine (Meta-Regression)', '10.1007/s40279-025-02344-w'),
  spiering: doi('Spiering et al. 2021, Journal of Strength and Conditioning Research', '10.1519/JSC.0000000000003964'),
  robinson: doi('Robinson et al. 2024, Sports Medicine (Meta-Regression)', '10.1007/s40279-024-02069-2'),
  moranNavarro: doi('Morán-Navarro et al. 2017, European Journal of Applied Physiology', '10.1007/s00421-017-3725-7'),
  schumann: doi('Schumann et al. 2022, Sports Medicine (Metaanalyse)', '10.1007/s40279-021-01587-7'),
  ding: doi('Ding et al. 2025, The Lancet Public Health (Metaanalyse)', '10.1016/S2468-2667(25)00164-1'),
  schoenfeldContreras: doi('Schoenfeld und Contreras 2013, Strength and Conditioning Journal', '10.1519/SSC.0b013e3182a61820'),
  hyldahl: doi('Hyldahl et al. 2017, Exercise and Sport Sciences Reviews', '10.1249/JES.0000000000000095'),
  dgaum: {
    label: 'DGAUM: S2k-Leitlinie Nacht- und Schichtarbeit, AWMF 002-030 (in Überarbeitung)',
    url: 'https://register.awmf.org/de/leitlinien/detail/002-030',
  },
  dguv: {
    label: 'DGUV Information 206-027 „Leben mit Schichtarbeit“, 2025 (PDF)',
    url: 'https://publikationen.dguv.de/widgets/pdf/download/article/3551',
  },
  dge: {
    label: 'Deutsche Gesellschaft für Ernährung: Essen bei Nacht- und Schichtarbeit, 2021',
    url: 'https://www.dge.de/presse/meldungen/2021/essen-bei-nacht-und-schichtarbeit/',
  },
};

export const KNOWLEDGE = [
  /* ---------- Schicht und Schlaf ---------- */
  {
    id: 'morgens-oder-abends', group: 'schicht', evidence: 'belegt',
    title: 'Morgens oder abends?',
    teaser: 'Für den Muskelaufbau ist die Uhrzeit zweitrangig.',
    text: 'In Studien wachsen die Muskeln bei Training am Morgen genauso wie am Abend. Am späten Nachmittag ist man meist etwas kräftiger, doch wer regelmäßig morgens trainiert, holt das zu seiner Trainingszeit weitgehend auf. Wichtiger als die Uhrzeit ist, dass du dranbleibst.',
    sources: [SRC.grgic, SRC.bruggisser],
  },
  {
    id: 'lerche-oder-eule', group: 'schicht', evidence: 'belegt',
    title: 'Lerche oder Eule?',
    teaser: 'Deine innere Uhr bestimmt mit, wann du am kräftigsten bist.',
    text: 'Menschen haben unterschiedliche innere Uhren, den sogenannten Chronotyp. Frühtypen sind morgens leistungsfähiger, Spättypen erst später am Tag. Wenn du die Wahl hast, lege schwere Einheiten eher in deine starke Tageszeit.',
    sources: [SRC.facerChilds],
  },
  {
    id: 'nach-nachtschicht-schlafen', group: 'schicht', evidence: 'abgeleitet',
    title: 'Nach der Nachtschicht: erst schlafen',
    teaser: 'Nach einer durchwachten Nacht erst schlafen, dann trainieren.',
    text: 'Nach einer durchwachten Nacht sinkt die Leistung im Training in Studien deutlich. Dazu sagen Morgenlicht und Anstrengung dem Körper „Tag“ und können den Tagschlaf erschweren. Darum plant Split Training frühestens 8 Stunden nach Schichtende ein. Nach der letzten Nacht einer Folge endet es bis 20 Uhr, damit du abends zur gewohnten Zeit einschlafen kannst.',
    sources: [SRC.craven, SRC.dguv],
  },
  {
    id: 'vor-nachtschicht-nachmittag', group: 'schicht', evidence: 'abgeleitet',
    title: 'Vor der Nachtschicht: den Nachmittag nutzen',
    teaser: 'Training am Nachmittag lässt vor der Nacht Zeit für Essen und ein Nickerchen.',
    text: 'Vor einer Nachtschicht passt Training am Nachmittag oder frühen Abend. Plane danach Zeit für Essen, Duschen und gern ein kurzes Nickerchen ein, das kann in der Nacht wacher halten. Split lässt deshalb drei Stunden bis Schichtbeginn frei.',
    sources: [SRC.dgaum, SRC.shriane],
  },
  {
    id: 'nach-fruehschicht-fertig', group: 'schicht', evidence: 'abgeleitet',
    title: 'Nach der Frühschicht: rechtzeitig fertig werden',
    teaser: 'Vor der nächsten Frühschicht ist der Schlaf ohnehin knapp.',
    text: 'Vor Frühschichten fällt der Schlaf kürzer aus, und zwar umso kürzer, je früher die Schicht beginnt. Training am Nachmittag passt gut, sollte aber einige Stunden vor dem Schlafengehen enden. Split plant das Ende darum drei Stunden vor der geschätzten Schlafenszeit, bei Schichtbeginn um 6 Uhr also bis 18:30. Tage mit Spätschicht nimmt Split lieber: Du trainierst vor der Schicht und hast meist länger geschlafen.',
    sources: [SRC.ingre, SRC.frimpong],
  },
  {
    id: 'abends-trainieren-schlaf', group: 'schicht', evidence: 'belegt',
    title: 'Abends trainieren und trotzdem gut schlafen',
    teaser: 'Abendtraining stört den Schlaf meist nicht, wenn etwas Abstand bleibt.',
    text: 'Training am Abend verschlechtert den Schlaf in Studien meist nicht. Kritisch wird es erst, wenn eine sehr harte Einheit kurz vor dem Zubettgehen endet. Endete sie mindestens zwei Stunden vorher, zeigte sich in Studien kein Nachteil.',
    sources: [SRC.frimpong, SRC.stutz],
  },
  {
    id: 'kurze-nacht-leichter', group: 'schicht', evidence: 'abgeleitet',
    title: 'Kurze Nacht? Lieber leichter trainieren',
    teaser: 'Nach wenig Schlaf lieber etwas leichter trainieren, statt ganz auszusetzen.',
    text: 'Schon wenige kurze Nächte können die Kraft senken, vor allem bei Grundübungen wie Kniebeuge oder Kreuzheben und später am Tag. Ausfallen lassen musst du deshalb nicht. Ein Satz weniger oder etwas mehr Luft bis zum Muskelversagen hält die Einheit machbar. Split schlägt das ab der zweiten Nachtschicht in Folge vor und wenn zwischen zwei Schichten weniger als 11 Stunden liegen.',
    sources: [SRC.knowles, SRC.craven],
  },
  {
    id: 'schlaf-pro-tag', group: 'schicht', evidence: 'belegt',
    title: 'Schlaf zählt pro Tag',
    teaser: 'Mit Schichtarbeit darf sich der Schlaf auf mehrere Phasen verteilen.',
    text: 'Empfohlen sind 7 bis 9 Stunden Schlaf in 24 Stunden, mit Schichtarbeit gern auch auf mehrere Schlafphasen verteilt. Ein Nickerchen von 15 bis 20 Minuten macht wacher, etwa 90 Minuten bauen Schlafschuld ab. Lange Nickerchen legst du besser nicht in die Stunden vor dem Hauptschlaf.',
    sources: [SRC.shriane, SRC.watson],
  },
  {
    id: 'licht-heimweg', group: 'schicht', evidence: 'belegt',
    title: 'Licht auf dem Heimweg',
    teaser: 'Nach der Nachtschicht helles Licht meiden, wenn du gleich schlafen willst.',
    text: 'Helles Tageslicht macht wach und stellt die innere Uhr auf „Tag“. Wer nach der Nachtschicht schlafen will, kann auf dem Heimweg eine getönte Brille tragen und das Schlafzimmer gut abdunkeln. Wenn du selbst fährst und sehr müde bist, geht Sicherheit vor.',
    sources: [SRC.dguv, SRC.shriane],
  },
  {
    id: 'koffein-wirkdauer', group: 'schicht', evidence: 'belegt',
    title: 'Koffein wirkt länger, als man denkt',
    teaser: 'Viel Koffein kann den Schlaf noch nach vielen Stunden stören.',
    text: 'Koffein hält in der Schicht wach und wird auch vor dem Training gern genommen. Eine große Menge, wie sie in manchen Pre-Workout-Boostern steckt, kann den Schlaf noch nach vielen Stunden stören, eine Tasse Kaffee deutlich weniger. Im letzten Drittel der Nachtschicht und in den Stunden vor dem Schlafen verzichtest du besser darauf. Endet dein Training vor einer Frühschicht oder am Tag nach der letzten Nachtschicht weniger als 8 Stunden vor dem Schlafen, erinnert Split daran.',
    sources: [SRC.gardiner25, SRC.gardiner23, SRC.dguv],
  },
  {
    id: 'essen-nachtschicht', group: 'schicht', evidence: 'belegt',
    title: 'Essen in der Nachtschicht',
    teaser: 'Hauptmahlzeiten am Tag, nachts eher klein und leicht.',
    text: 'Nachts ist die Verdauung auf Ruhe eingestellt. Hauptmahlzeiten gehören möglichst in den Tag, nachts eher kleine, leichte Snacks und in der zweiten Nachthälfte möglichst wenig. Nach der Schicht gehst du am besten weder hungrig noch mit vollem Magen ins Bett.',
    sources: [SRC.dge, SRC.dguv, SRC.chellappa],
  },

  /* ---------- Ernährung ---------- */
  {
    id: 'eiweiss-menge', group: 'ernaehrung', evidence: 'belegt',
    title: 'Wie viel Eiweiß?',
    teaser: 'Bis etwa 1,6 Gramm pro Kilogramm Körpergewicht steigt der Nutzen deutlich.',
    text: 'Beim Muskelaufbau mit Krafttraining steigt der Nutzen in Studien bis etwa 1,6 Gramm Eiweiß pro Kilogramm Körpergewicht am Tag. Darüber bringt mehr im Mittel nur noch wenig. Split rechnet mit etwas mehr, damit Spielraum bleibt. Auf mehrere Mahlzeiten verteilt ist die Menge leichter zu schaffen.',
    sources: [SRC.morton],
  },
  {
    id: 'eiweiss-vor-dem-schlafen', group: 'ernaehrung', evidence: 'belegt',
    title: 'Eiweiß vor dem Schlafen',
    teaser: 'Eine eiweißreiche Spätmahlzeit hilft vor allem über die Tagesmenge.',
    text: 'Eine eiweißreiche Mahlzeit vor dem Schlafen, etwa Quark, versorgt die Muskeln über die Nacht mit Bausteinen. Der Vorteil kommt in Studien vor allem daher, dass so die Tagesmenge steigt. Vor dem Tagschlaf nach der Nachtschicht gilt: nur wenn du Hunger hast, und dann klein und leicht.',
    sources: [SRC.reis, SRC.dguv],
  },
  {
    id: 'kreatin', group: 'ernaehrung', evidence: 'belegt',
    title: 'Kreatin: gut untersucht',
    teaser: 'Eines der am besten untersuchten Nahrungsergänzungsmittel.',
    text: 'Kreatinmonohydrat gehört zu den am besten untersuchten Nahrungsergänzungsmitteln. Zusammen mit Krafttraining nahmen Kraft und Muskelmasse in Studien im Mittel etwas stärker zu. Die Fachgesellschaft ISSN hält es für gesunde Erwachsene für unbedenklich. Bei Vorerkrankungen, etwa der Nieren, in der Schwangerschaft oder wenn du Medikamente nimmst, kläre es vorher ärztlich ab.',
    sources: [SRC.kreider, SRC.antonio],
  },
  {
    id: 'abnehmen-muskeln-halten', group: 'ernaehrung', evidence: 'belegt',
    title: 'Abnehmen, ohne Muskeln zu verlieren',
    teaser: 'Langsam abnehmen und dabei weiter Kraft trainieren.',
    text: 'Ein großes Kaloriendefizit bremst den Muskelaufbau. Ab etwa 500 Kilokalorien Defizit am Tag gab es in Studien kaum noch Zuwachs an Magermasse, die Kraft konnte trotzdem steigen. Langsam abnehmen und weiter Krafttraining machen hilft, die Muskeln zu halten.',
    sources: [SRC.murphy, SRC.garthe],
  },

  /* ---------- Training ---------- */
  {
    id: 'saetze-pro-woche', group: 'training', evidence: 'belegt',
    title: 'Wie viele Sätze pro Woche?',
    teaser: 'Split zielt auf 10 bis 20 Sätze pro Muskel und Woche.',
    text: 'Mehr Sätze pro Muskel und Woche bringen im Mittel mehr Wachstum, der Zugewinn wird aber kleiner, je mehr es schon sind. Split zielt auf 10 bis 20 Sätze pro Muskel, Übungen, die ihn nur mittrainieren, zählen halb. Kleine Muskelgruppen wie Waden und Bauch brauchen weniger, Split zielt dort auf 4 bis 10; Nacken und unterer Rücken arbeiten bei Grundübungen mit und haben kein eigenes Ziel. Um den Stand in anstrengenden Wochen zu halten, reichen in Studien schon deutlich weniger Sätze.',
    sources: [SRC.pelland, SRC.spiering],
  },
  {
    id: 'naehe-muskelversagen', group: 'training', evidence: 'belegt',
    title: 'Wie nah ans Muskelversagen?',
    teaser: 'Ein bis drei Wiederholungen Reserve sind ein guter Mittelweg.',
    text: 'Muskeln wachsen in Studien umso besser, je näher deine Sätze an das Muskelversagen gehen. Für den Kraftzuwachs ist das weniger wichtig. Sätze bis zum Versagen verlängern aber die Erholung, darum sind ein bis drei Wiederholungen Reserve ein guter Mittelweg.',
    sources: [SRC.robinson, SRC.moranNavarro],
  },
  {
    id: 'cardio-und-kraft', group: 'training', evidence: 'belegt',
    title: 'Cardio und Muskelaufbau vertragen sich',
    teaser: 'Ausdauertraining bremst den Muskelaufbau in Studien nicht.',
    text: 'Ausdauertraining zusätzlich zum Krafttraining schmälert in Studien weder das Muskelwachstum noch die Maximalkraft. Nur die Schnellkraft kann etwas leiden, vor allem wenn beides in derselben Einheit stattfindet.',
    sources: [SRC.schumann],
  },
  {
    id: 'schritte', group: 'training', evidence: 'belegt',
    title: 'Schritte zählen mit',
    teaser: 'Auch Bewegung im Alltag zählt, am deutlichsten bis etwa 7.000 Schritte.',
    text: 'Alltagsbewegung zählt. In großen Beobachtungsstudien ging mehr Gehen mit besserer Gesundheit einher, der größte Zugewinn lag bis etwa 7.000 Schritte am Tag. Darüber wird der zusätzliche Nutzen kleiner, schadet aber nicht.',
    sources: [SRC.ding],
  },
  {
    id: 'muskelkater', group: 'training', evidence: 'belegt',
    title: 'Muskelkater ist kein Maßstab',
    teaser: 'Kein Muskelkater heißt nicht, dass das Training nichts gebracht hat.',
    text: 'Muskelkater zeigt vor allem, dass eine Belastung ungewohnt war. Schon nach wenigen Einheiten derselben Übung lässt er deutlich nach, während die Muskeln weiter wachsen. Kein Muskelkater heißt also nicht, dass das Training nichts gebracht hat.',
    sources: [SRC.schoenfeldContreras, SRC.hyldahl],
  },
];

export const findKnowledge = id => KNOWLEDGE.find(k => k.id === id) || null;
