# 📋 GMAO PRO USINE - Guide d'Installation Complet

## 🎯 Vue d'ensemble

Ce package contient une application CMMS (GMAO) complète et professionnelle :
- **Application PWA** (Progressive Web App) installable sur mobile
- **Backend Google Apps Script** connecté à Google Sheets
- **Base de données** avec 10 000 pièces de rechange

---

## 📁 Contenu du Package

| Fichier | Description |
|---------|-------------|
| `index.html` | Application PWA principale |
| `manifest.json` | Configuration PWA |
| `sw.js` | Service Worker (mode hors-ligne) |
| `icon-192.png` | Icône 192x192 |
| `icon-512.png` | Icône 512x512 |
| `Code.gs` | Backend Google Apps Script |
| `BASE_DONNEES_GMAO.xlsx` | Base de données Excel (10 000 pièces) |

---

## 🚀 INSTALLATION - Étape par Étape

### ÉTAPE 1 : Créer la Google Sheet

1. Aller sur [Google Sheets](https://sheets.google.com)
2. Créer une nouvelle feuille de calcul
3. Nommer la feuille : `GMAO_PRO_DATABASE`
4. **Importer le fichier Excel** :
   - Fichier → Importer → Télécharger
   - Sélectionner `BASE_DONNEES_GMAO.xlsx`
   - Choisir "Remplacer la feuille de calcul"
5. Vérifier que les 12 onglets sont présents :
   - Utilisateurs
   - Machines
   - Zones
   - Composants
   - Types_Anomalies
   - Techniciens
   - Operateurs
   - Pieces_JDE (10 000 articles)
   - Historique
   - Bons_Travail
   - Sorties_Stock
   - Notifications

### ÉTAPE 2 : Déployer Google Apps Script

1. Dans Google Sheets, aller dans **Extensions → Apps Script**
2. Supprimer tout le code existant
3. Copier-coller le contenu de `Code.gs`
4. Sauvegarder (Ctrl+S)
5. **Déployer** :
   - Cliquer sur **Déployer → Nouveau déploiement**
   - Type : **Application Web**
   - Description : "GMAO PRO API v2.0"
   - Exécuter en tant que : **Moi**
   - Accès : **Tout le monde**
   - Cliquer sur **Déployer**
6. **Autoriser** l'application (accepter les permissions Google)
7. **COPIER L'URL** du déploiement (elle ressemble à) :
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

### ÉTAPE 3 : Configurer l'Application

1. Ouvrir le fichier `index.html` avec un éditeur de texte
2. Rechercher la ligne (vers ligne 626) :
   ```javascript
   if(!localStorage.getItem('bahia_url')) localStorage.setItem('bahia_url', 'VOTRE_URL_ICI');
   ```
3. Remplacer `VOTRE_URL_ICI` par l'URL copiée à l'étape 2
4. Sauvegarder le fichier

### ÉTAPE 4 : Déployer sur GitHub Pages

1. Créer un nouveau repository GitHub (ex: `gmao-pro`)
2. Uploader les 5 fichiers :
   - index.html
   - manifest.json
   - sw.js
   - icon-192.png
   - icon-512.png
3. Aller dans **Settings → Pages**
4. Source : **Deploy from branch** → `main` → `/ (root)`
5. Sauvegarder
6. Attendre 2-3 minutes
7. L'URL sera : `https://VOTRE_USERNAME.github.io/gmao-pro/`

### ÉTAPE 5 : Tester l'Application

1. Ouvrir l'URL GitHub Pages sur votre téléphone
2. Se connecter avec :
   - **Admin** : admin / admin123
   - **Technicien** : tech1 / tech123
   - **Opérateur** : op1 / op123
3. Tester les fonctionnalités :
   - Créer un signalement
   - Vérifier le BT automatique
   - Consulter le stock PDR

### ÉTAPE 6 : Installer comme Application (Optionnel)

**Sur Android (Chrome)** :
1. Ouvrir l'URL dans Chrome
2. Menu ⋮ → "Ajouter à l'écran d'accueil"

**Sur iPhone (Safari)** :
1. Ouvrir l'URL dans Safari
2. Bouton partage → "Sur l'écran d'accueil"

**Générer APK (PWABuilder)** :
1. Aller sur https://www.pwabuilder.com
2. Entrer l'URL GitHub Pages
3. Générer le package Android
4. Télécharger et installer l'APK

---

## 📱 Fonctionnalités de l'Application

### Module Signalement
- ⏱️ Timer d'arrêt machine
- 🎤 Saisie vocale (Français/Arabe)
- 📸 Photo caméra/galerie
- 📋 Sélection en cascade : Ligne → Machine → Zone → Composant → Anomalie
- 👨‍🔧 Sélection multiple de techniciens
- 📤 Partage WhatsApp
- ✅ Création automatique de BT

### Module Maintenance
- 📋 Liste des BT ouverts
- 🔄 Workflow : En cours → Attente pièce → Clôturé
- ⏱️ Timer intervention
- 📦 Sélection des pièces utilisées
- 📊 Historique des BT

### Module Stock PDR
- 📦 10 000 articles référencés
- 🔍 Recherche par code ou désignation
- ⚠️ Alertes stock critique
- 📊 Mouvements de stock (entrées/sorties)

### Module Rapports
- 📈 Taux de résolution
- 📊 KPI temps réel
- 📋 Statistiques globales

---

## 🔧 Personnalisation

### Ajouter des Machines
1. Ouvrir Google Sheets
2. Aller dans l'onglet `Machines`
3. Ajouter une ligne : Ligne | Machine
4. Ajouter les zones dans l'onglet `Zones`
5. Ajouter les composants dans l'onglet `Composants`

### Ajouter des Utilisateurs
1. Ouvrir Google Sheets
2. Aller dans l'onglet `Utilisateurs`
3. Ajouter une ligne :
   - Identifiant (login)
   - MotDePasse
   - Nom complet
   - Role (admin/technicien/operateur/production)
   - Actif (TRUE/FALSE)

### Ajouter des Pièces
1. Ouvrir Google Sheets
2. Aller dans l'onglet `Pieces_JDE`
3. Ajouter une ligne :
   - Code_JDE (ex: JDE-10001)
   - Designation
   - Unite (U/M/L/KG/Boîte)
   - Stock (quantité)
   - Type (Mécanique/Électrique/...)
   - Seuil_Alerte
   - Emplacement
   - Fournisseur

---

## 🐛 Dépannage

### "Configurez d'abord le serveur"
→ L'URL Google Script n'est pas configurée dans index.html

### "Identifiants incorrects"
→ Vérifier l'onglet Utilisateurs dans Google Sheets
→ S'assurer que la colonne "Actif" = TRUE

### Erreur CORS
→ Vérifier que le déploiement Google Script est en "Accès: Tout le monde"
→ Re-déployer avec un nouveau déploiement

### Données non chargées
→ Vérifier la console du navigateur (F12)
→ Tester l'URL API directement dans le navigateur

---

## 📞 Support

Pour toute question, vérifier :
1. Que l'URL Google Script est correcte
2. Que les permissions Google sont acceptées
3. Que les onglets Google Sheets ont les bons noms
4. Que le format des données est correct

---

**Version 2.0.0 - CMMS Professional**
