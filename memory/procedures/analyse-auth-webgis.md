# Procedure d'analyse d'authentification WebGIS

## Contexte
Cette procedure permet d'analyser le systeme d'authentification d'un geoportail (QWC2, GeoServer, MapServer, etc.) pour l'integrer dans une application tierce.

## Etape 1 : Identifier le type de geoportail

### URLs a tester
```
https://[domaine]/config.json          # Configuration QWC2
https://[domaine]/themes.json          # Themes disponibles
https://[domaine]/api/                 # API REST
https://[domaine]/ows?SERVICE=WMS&REQUEST=GetCapabilities
https://[domaine]/wms?SERVICE=WMS&REQUEST=GetCapabilities
```

### Resultat pour geo.bussigny.ch
- Type : QWC2 (QGIS Web Client 2)
- Config : `https://geo.bussigny.ch/config.json`
- Themes : `https://geo.bussigny.ch/themes.json`
- Auth endpoint : `/auth/`

## Etape 2 : Analyser les services WMS disponibles

### Services identifies
| Theme | URL WMS | Couches |
|-------|---------|---------|
| Route | `https://geo.bussigny.ch/ows/route` | Transport public, Vitesse, Cadastre |
| Assainissement | `https://geo.bussigny.ch/ows/assainissement` | Couvercle, Chambre, Collecteurs |
| Nature | `https://geo.bussigny.ch/ows/nature` | Balades |
| Points interet | `https://geo.bussigny.ch/ows/pts_interet` | POI |

### Fonds de plan (WMTS)
- ASIT VD : `https://wmts.asit-asso.ch/wmts/`
- Swisstopo : `https://wmts.geo.admin.ch/`

## Etape 3 : Analyser l'authentification (DevTools)

### Procedure
1. Ouvrir le geoportail dans le navigateur
2. F12 > Network > Cocher "Preserve log"
3. Filtrer par "auth" dans le champ de recherche
4. Se connecter et observer les requetes

### Resultat pour geo.bussigny.ch

#### Page de login
- URL : `https://geo.bussigny.ch/auth/login?url=[redirect]`
- Methode : GET (affiche le formulaire)
- Formulaire HTML avec :
  - `csrf_token` (hidden)
  - `username` (text)
  - `password` (password)
  - Action : POST

#### Soumission du formulaire
- Methode : POST
- Content-Type : `application/x-www-form-urlencoded`
- Body : `csrf_token=xxx&username=xxx&password=xxx`
- Reponse : 302 Redirect + Set-Cookie

#### Cookies de session
```
access_token_cookie=eyJ... (JWT)
csrf_access_token=...
session=...
```

## Etape 4 : Verifier les requetes authentifiees

### Procedure
1. Une fois connecte, filtrer par "ows" dans Network
2. Cliquer sur une requete WMS
3. Onglet Headers > Request Headers
4. Verifier le header "Cookie"

### Resultat
Les requetes WMS incluent automatiquement les cookies :
```
Cookie: access_token_cookie=eyJ...; csrf_access_token=...; session=...
```

## Etape 5 : Implementation du proxy

### Architecture
```
[GeoBrain Frontend]
       |
       v
[GeoBrain Backend Proxy]
       |
       | (avec cookies de session)
       v
[geo.bussigny.ch]
```

### Flux d'authentification
1. User entre credentials dans GeoBrain
2. Backend recupere le csrf_token depuis /auth/login
3. Backend POST les credentials
4. Backend stocke les cookies de session
5. Les requetes WMS passent par le proxy avec les cookies

### Points d'attention
- Le csrf_token change a chaque requete
- Les cookies ont une duree de vie limitee
- Prevoir un refresh automatique de la session

## Fichiers de reference
- Screenshots : `docs/Capture d'ecran 2025-12-09 122*.png`
- Config geoportail : `https://geo.bussigny.ch/config.json`
- Themes : `https://geo.bussigny.ch/themes.json`

---
*Document cree le 2025-12-09 par GeoBrain*
*A mettre a jour si le systeme d'auth du geoportail change*
