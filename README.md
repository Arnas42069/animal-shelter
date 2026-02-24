# Prisijungimas

## 1️⃣ `SSH` rakto sukūrimas (darbo kompiuteryje)

WINDOWS CMD terminale paleisti komandas:

```bash
ssh-keygen -t ed25519
```

```bash
type %USERPROFILE%\.ssh\id_ed25519.pub
```

Visus laukus palikti tuščius
Nukopijuotą pilną raktą atsiųsti


## 2️⃣ Prisijungimas prie serverio per `Terminalą`.

Patogiausia per `POWERSHEWLL` bet galima ir per `CMD`


## 3️⃣ Prisijungimas prie serverio per `VSCode`.




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


## Patikrinti aktyvų branch:

```bash
git branch
```


## Pakeisti branch:

```bash
git switch main 
```

```bash
git switch `YourBranch`
```

Tik pilnai veikianti sistemos update kelti į `main` branch ir būtinai turint naujausią `main` versiją.
Nuolat darbo kelti į savo branch nėra būtina, tačiau tai gera praktika, nes taip lengviau atstatyti jei bus netyčia sugadinti `main` failai arba vykdant `pull` komandą ant viršaus perrašyti jūsų koreguoti failai.


## Pridėti atnaujinimą `push`:

```bash 
git add .
git commit -m "Vardas: kas atnaujinta"
git push
```










