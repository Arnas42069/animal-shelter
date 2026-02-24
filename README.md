# Prisijungimas

## `SSH` rakto sukūrimas (darbo kompiuteryje)

WINDOWS CMD terminale paleisti komandas:

```bash
ssh-keygen -t ed25519
```

```bash
type %USERPROFILE%\.ssh\id_ed25519.pub
```

Visus laukus palikti tuščius
Nukopijuotą pilną raktą atsiųsti


## Prisijungimas prie serverio per `Terminalą`.

Patogiausia per `POWERSHEWLL` bet galima ir per `CMD`


## Prisijungimas prie serverio per `VSCode`.




# GITHUB valdymas

## Darbo katalogas:

```bash
cd Shelter
```


## Pirmą kartą reiks atlikti:

```bash
git config --global user.email "you@example.com" 
git config --global user.name "Your Name"
```

geriausia, jog sutarptų su tuo ką naudojate per GitHub


## Patikrinti aktyvų ir pakeisti branch:

```bash
git branch
git switch `YourBranch`
```

Tiesiogiai į `main` branch nedaryti jokių `commit`, atnaujinimus pirmiausia kelti į savo branch


## Patikrinti ar yra atnaujinimų:

Rekomenduojama atlikti:
    prieš pradedant darbą,
    ir baigus darbą, prieš atliekant `commit` į savo branch.

Tai padeda išvengti merge konfliktų ir užtikrina, kad dirbate su naujausia projekto versija.

```bash
git fetch origin
git log HEAD..origin/main --oneline
```

Jeigu netuščia tuomet atnaujinimų yra ir reikia atsinaujinti


## Atsinaujinti iš `main`:

```bash
git switch main
git pull origin main
git switch `YourBranch`
git merge main
```


## Pridėti atnaujinimą prie savo branch:

Galima vykdyti betkada

```bash 
git add .
git commit -m "Vardas: kas atnaujinta"
git push
```


## Savo branch sujungti su main:

Vykdyti tik tuomet kai turima naujausia `main` versija ir jūsų atnaujinimas pilnai veikiantis.

```bash
git switch main
git merge `YourBranch`
git push origin main
git switch `YourBranch`
```


# DOCKER valdymas

## Paleisti

```bash
docker compose up -d
```

## Išjungti

```bash
docker compose down
```


## Sunaikinti konteirius ir duomenų bazę (Clean Slate)

```bash
docker compose down -v
```
