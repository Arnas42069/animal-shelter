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

geriausia, jog sutarptų su tuo ką naudojate per GitHub

## Patikrinti sąrašą ir aktyvų branch:

```bash
git branch
```


## Pakeisti branch:

```bash
git switch `YourBranch`
```

Tiesiogiai į `main` branch nedaryti jokių `commit`, atnaujinimus pirmiausia kelti į savo branch


## Pridėti atnaujinimą prie savo branch:

```bash 
git add .
git commit -m "Vardas: kas atnaujinta"
git push
```


## Savo branch sujungti su main:
```bash
git switch main
git merge `YourBranch`
git push origin main
git switch `YourBranch`
```


git fetch origin












