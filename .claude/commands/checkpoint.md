Sauvegarde l'etat actuel de la session dans memory/checkpoint.md en utilisant le format compact :

CP-[YYYYMMDD-HHMM]
S:[numero session]|P:[phase]|T:[theme]
F:[fichiers modifies]
W:[travail effectue - resume compact]
N:[prochaines etapes]
X:[infos importantes a retenir]

Ensuite, fais un commit git avec le message 'checkpoint: [theme court]' et push sur GitHub.
Confirme la sauvegarde avec le numero du checkpoint cree.
