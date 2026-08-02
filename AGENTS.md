# Phile AI-werkkaart

Phile is een volledig zelfstandige, frameworkloze statische Leerbox. Een
checkout, test of deployment mag geen bestanden uit buurrepository's nodig
hebben.

## Grenzen

- Deze repository bezit uitsluitend de statische shell en de spelmechaniek.
- LeerpretEngine bezit runtime-data, thematokens, opslag, verwerking en de
  canonieke LeerpretSDK.
- Koppeling met LeerpretEngine verloopt uitsluitend via configureerbare HTTP-URL's.
- Voeg geen lokale kopie van de LeerpretSDK, filosoofkaartdata of serverdata toe.
- Iedere betekenisvolle spelersinteractie loopt via een `Leerobject`-subklasse
  uit de door LeerpretEngine geserveerde SDK.
- Commit of push niet zonder expliciete toestemming.

## Verificatie

```powershell
node --test
python -m unittest discover tests
```

Lokaal draaien:

```powershell
python scripts\generate_runtime_config.py
python -m http.server 47115
```
