// ═══════════════════════════════════════════════════════════════════════════════
// GMAO BAHIA v8.4 - Backend Google Apps Script OPTIMISÉ
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION v8.4 - Structure de la base de données
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG_V84 = {
  // Onglets requis avec leurs colonnes
  sheets: {
    'Machines': ['Machine', 'Ligne', 'Description'],
    'Zones': ['Zone', 'Machine', 'Description'],
    'Composants': ['Composant', 'Zone', 'Description'],
    'Types_Anomalies': ['Anomalie', 'Description', 'Priorite'],
    'Descriptions_Anomalies': ['Type_Anomalie', 'Description_Standard', 'Priorite'],
    'Techniciens': ['Nom', 'Telephone', 'Specialite', 'Fonction'],
    'Utilisateurs': ['Identifiant', 'MotDePasse', 'Nom', 'Role', 'Actif'],
    'Historique': ['ID', 'Date', 'Heure', 'Heure_Arrivee_Maint', 'Operateur', 'Ligne', 'Machine', 'Zone', 'Composant', 'Anomalie', 'Description', 'Techniciens', 'Commentaire', 'Photo', 'Statut', 'User_ID', 'BT_ID'],
    'Bons_Travail': ['BT_ID', 'Date', 'Heure', 'Anomalie_ID', 'Technicien', 'Cause', 'Diagnostic', 'Action_Type', 'Action_Detail', 'Pieces', 'Heure_Arrivee', 'Heure_Fin', 'Heure_Validation', 'Statut', 'User_ID', 'Historique'],
    'Compteurs': ['Type', 'Date', 'Compteur']
  },
  
  // Onglets à SUPPRIMER (v8.3 → v8.4)
  sheetsToDelete: ['Pieces_JDE', 'Sorties_Stock'],
  
  // Colonnes à SUPPRIMER par onglet
  columnsToDelete: {
    'Bons_Travail': ['Signature', 'GPS_Lat', 'GPS_Lng', 'Duree'],
    'Historique': ['Duree', 'GPS_Lat', 'GPS_Lng']
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REORGANISER BDD - Fonction principale de migration v8.3 → v8.4
// Menu: Exécuter > Exécuter la fonction > reorganiserBDD
// ═══════════════════════════════════════════════════════════════════════════════

function reorganiserBDD() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  let log = [];
  
  // Confirmation
  const confirm = ui.alert(
    '⚠️ RÉORGANISATION BDD v8.4',
    'Cette opération va:\n\n' +
    '1. Créer les onglets manquants\n' +
    '2. Ajouter les colonnes manquantes\n' +
    '3. Supprimer les onglets obsolètes (PDR, Sorties)\n' +
    '4. Supprimer les colonnes obsolètes\n\n' +
    'Voulez-vous continuer?',
    ui.ButtonSet.YES_NO
  );
  
  if (confirm !== ui.Button.YES) {
    ui.alert('Opération annulée');
    return;
  }
  
  log.push('═══════════════════════════════════════');
  log.push('RÉORGANISATION BDD GMAO v8.4');
  log.push('═══════════════════════════════════════');
  log.push('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 1: Créer les onglets manquants
  // ═══════════════════════════════════════════════════════════════════════════
  log.push('📁 ÉTAPE 1: Vérification des onglets...');
  
  for (const [sheetName, headers] of Object.entries(CONFIG_V84.sheets)) {
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      // Créer l'onglet
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1e40af')
        .setFontColor('#ffffff');
      log.push('  ✅ Onglet "' + sheetName + '" créé');
    } else {
      log.push('  ℹ️ Onglet "' + sheetName + '" existe');
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 2: Ajouter les colonnes manquantes
  // ═══════════════════════════════════════════════════════════════════════════
  log.push('');
  log.push('📊 ÉTAPE 2: Vérification des colonnes...');
  
  for (const [sheetName, requiredHeaders] of Object.entries(CONFIG_V84.sheets)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;
    
    const lastCol = sheet.getLastColumn();
    let currentHeaders = [];
    
    if (lastCol > 0) {
      currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    
    // Vérifier chaque colonne requise
    requiredHeaders.forEach((header, index) => {
      const existingIndex = currentHeaders.indexOf(header);
      
      if (existingIndex === -1) {
        // Colonne n'existe pas → l'ajouter à la fin
        const newCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, newCol).setValue(header);
        sheet.getRange(1, newCol)
          .setFontWeight('bold')
          .setBackground('#1e40af')
          .setFontColor('#ffffff');
        log.push('  ✅ Colonne "' + header + '" ajoutée à "' + sheetName + '"');
      }
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 3: Supprimer les onglets obsolètes
  // ═══════════════════════════════════════════════════════════════════════════
  log.push('');
  log.push('🗑️ ÉTAPE 3: Suppression onglets obsolètes...');
  
  CONFIG_V84.sheetsToDelete.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      // Vérifier si l'onglet contient des données
      const dataRows = sheet.getLastRow() - 1;
      if (dataRows > 0) {
        log.push('  ⚠️ Onglet "' + sheetName + '" contient ' + dataRows + ' lignes - ARCHIVÉ (renommé)');
        sheet.setName(sheetName + '_ARCHIVE_' + new Date().toISOString().slice(0,10));
      } else {
        ss.deleteSheet(sheet);
        log.push('  ✅ Onglet "' + sheetName + '" supprimé (vide)');
      }
    } else {
      log.push('  ℹ️ Onglet "' + sheetName + '" n\'existe pas');
    }
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 4: Supprimer les colonnes obsolètes
  // ═══════════════════════════════════════════════════════════════════════════
  log.push('');
  log.push('🗑️ ÉTAPE 4: Suppression colonnes obsolètes...');
  
  for (const [sheetName, columnsToDelete] of Object.entries(CONFIG_V84.columnsToDelete)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;
    
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) continue;
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // Supprimer de droite à gauche pour éviter les décalages
    for (let i = headers.length - 1; i >= 0; i--) {
      if (columnsToDelete.includes(headers[i])) {
        // Vérifier si la colonne contient des données
        const colData = sheet.getRange(2, i + 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
        const hasData = colData.some(row => row[0] !== '' && row[0] !== null);
        
        if (hasData) {
          log.push('  ⚠️ Colonne "' + headers[i] + '" dans "' + sheetName + '" contient des données - NON supprimée');
        } else {
          sheet.deleteColumn(i + 1);
          log.push('  ✅ Colonne "' + headers[i] + '" supprimée de "' + sheetName + '"');
        }
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 5: Ajouter utilisateur chef_equipe si manquant
  // ═══════════════════════════════════════════════════════════════════════════
  log.push('');
  log.push('👥 ÉTAPE 5: Vérification utilisateurs...');
  
  const usersSheet = ss.getSheetByName('Utilisateurs');
  if (usersSheet) {
    const usersData = usersSheet.getDataRange().getValues();
    const hasChef = usersData.some(row => row[3] === 'chef_equipe');
    
    if (!hasChef) {
      usersSheet.appendRow(['chef1', 'chef123', 'Chef Équipe 1', 'chef_equipe', 'Oui']);
      log.push('  ✅ Utilisateur chef_equipe ajouté');
    } else {
      log.push('  ℹ️ Utilisateur chef_equipe existe');
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 6: Ajouter exemples Descriptions_Anomalies si vide
  // ═══════════════════════════════════════════════════════════════════════════
  log.push('');
  log.push('📝 ÉTAPE 6: Vérification descriptions...');
  
  const descSheet = ss.getSheetByName('Descriptions_Anomalies');
  if (descSheet && descSheet.getLastRow() <= 1) {
    const exemples = [
      ['Fuite', 'Fuite eau au niveau joint', 'Haute'],
      ['Fuite', 'Fuite huile sur vérin', 'Haute'],
      ['Fuite', 'Fuite air comprimé', 'Moyenne'],
      ['Bruit anormal', 'Bruit métallique répétitif', 'Moyenne'],
      ['Bruit anormal', 'Vibration excessive', 'Haute'],
      ['Blocage', 'Machine bloquée', 'Haute'],
      ['Défaut capteur', 'Capteur HS', 'Haute'],
      ['Surchauffe', 'Température élevée', 'Haute']
    ];
    exemples.forEach(row => descSheet.appendRow(row));
    log.push('  ✅ Descriptions exemples ajoutées');
  } else {
    log.push('  ℹ️ Descriptions déjà présentes');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSUMÉ
  // ═══════════════════════════════════════════════════════════════════════════
  log.push('');
  log.push('═══════════════════════════════════════');
  log.push('✅ RÉORGANISATION TERMINÉE');
  log.push('═══════════════════════════════════════');
  
  // Afficher le résultat
  ui.alert('RÉORGANISATION BDD v8.4', log.join('\n'), ui.ButtonSet.OK);
  Logger.log(log.join('\n'));
  
  return { success: true, log: log };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES DE GESTION BDD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ajouter une colonne à un onglet existant
 * @param {string} sheetName - Nom de l'onglet
 * @param {string} columnName - Nom de la colonne
 * @param {number} position - Position (optionnel, défaut: fin)
 */
function ajouterColonne(sheetName, columnName, position) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log('❌ Onglet "' + sheetName + '" non trouvé');
    return false;
  }
  
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  
  if (headers.includes(columnName)) {
    Logger.log('ℹ️ Colonne "' + columnName + '" existe déjà');
    return false;
  }
  
  const targetCol = position || (lastCol + 1);
  
  if (position && position <= lastCol) {
    sheet.insertColumnBefore(position);
  }
  
  sheet.getRange(1, targetCol).setValue(columnName);
  sheet.getRange(1, targetCol)
    .setFontWeight('bold')
    .setBackground('#1e40af')
    .setFontColor('#ffffff');
  
  Logger.log('✅ Colonne "' + columnName + '" ajoutée à "' + sheetName + '"');
  return true;
}

/**
 * Supprimer une colonne d'un onglet
 * @param {string} sheetName - Nom de l'onglet
 * @param {string} columnName - Nom de la colonne
 * @param {boolean} force - Supprimer même si contient des données
 */
function supprimerColonne(sheetName, columnName, force) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log('❌ Onglet "' + sheetName + '" non trouvé');
    return false;
  }
  
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return false;
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const colIndex = headers.indexOf(columnName);
  
  if (colIndex === -1) {
    Logger.log('ℹ️ Colonne "' + columnName + '" non trouvée');
    return false;
  }
  
  // Vérifier données
  if (!force && sheet.getLastRow() > 1) {
    const colData = sheet.getRange(2, colIndex + 1, sheet.getLastRow() - 1, 1).getValues();
    const hasData = colData.some(row => row[0] !== '' && row[0] !== null);
    if (hasData) {
      Logger.log('⚠️ Colonne "' + columnName + '" contient des données. Utilisez force=true');
      return false;
    }
  }
  
  sheet.deleteColumn(colIndex + 1);
  Logger.log('✅ Colonne "' + columnName + '" supprimée de "' + sheetName + '"');
  return true;
}

/**
 * Créer un nouvel onglet
 * @param {string} sheetName - Nom de l'onglet
 * @param {array} headers - Liste des colonnes
 */
function creerOnglet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (ss.getSheetByName(sheetName)) {
    Logger.log('ℹ️ Onglet "' + sheetName + '" existe déjà');
    return false;
  }
  
  const sheet = ss.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1e40af')
    .setFontColor('#ffffff');
  
  Logger.log('✅ Onglet "' + sheetName + '" créé');
  return true;
}

/**
 * Supprimer un onglet
 * @param {string} sheetName - Nom de l'onglet
 * @param {boolean} archive - Archiver au lieu de supprimer si données
 */
function supprimerOnglet(sheetName, archive) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log('ℹ️ Onglet "' + sheetName + '" non trouvé');
    return false;
  }
  
  const dataRows = sheet.getLastRow() - 1;
  
  if (archive && dataRows > 0) {
    sheet.setName(sheetName + '_ARCHIVE_' + new Date().toISOString().slice(0,10));
    Logger.log('✅ Onglet "' + sheetName + '" archivé');
  } else {
    ss.deleteSheet(sheet);
    Logger.log('✅ Onglet "' + sheetName + '" supprimé');
  }
  
  return true;
}

/**
 * Afficher la structure actuelle de la BDD
 */
function afficherStructureBDD() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let log = ['═══════════════════════════════════════', 'STRUCTURE BDD GMAO', '═══════════════════════════════════════', ''];
  
  sheets.forEach(sheet => {
    const name = sheet.getName();
    const lastCol = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    
    log.push('📁 ' + name + ' (' + (lastRow - 1) + ' lignes)');
    log.push('   Colonnes: ' + headers.join(', '));
    log.push('');
  });
  
  SpreadsheetApp.getUi().alert('Structure BDD', log.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  Logger.log(log.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP v8.4 - Exécuter UNE SEULE FOIS (version simplifiée)
// ═══════════════════════════════════════════════════════════════════════════════

function setupV84() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let log = [];
  
  // Onglets requis v8.4
  const requiredSheets = [
    { name: 'Machines', headers: ['Machine', 'Ligne', 'Description'] },
    { name: 'Zones', headers: ['Zone', 'Machine', 'Description'] },
    { name: 'Composants', headers: ['Composant', 'Zone', 'Description'] },
    { name: 'Types_Anomalies', headers: ['Anomalie', 'Description', 'Priorite'] },
    { name: 'Descriptions_Anomalies', headers: ['Type_Anomalie', 'Description_Standard', 'Priorite'] }, // v8.4 NEW
    { name: 'Techniciens', headers: ['Nom', 'Telephone', 'Specialite', 'Fonction'] }, // v8.4: +Fonction
    { name: 'Utilisateurs', headers: ['Identifiant', 'MotDePasse', 'Nom', 'Role', 'Actif'] },
    { name: 'Historique', headers: ['ID', 'Date', 'Heure', 'Operateur', 'Ligne', 'Machine', 'Zone', 'Composant', 'Anomalie', 'Description', 'Techniciens', 'Duree', 'Commentaire', 'Photo', 'Statut', 'User_ID', 'BT_ID'] }, // v8.4: +Description
    { name: 'Bons_Travail', headers: ['BT_ID', 'Date', 'Heure', 'Anomalie_ID', 'Technicien', 'Cause', 'Diagnostic', 'Action_Type', 'Action_Detail', 'Pieces', 'Heure_Arrivee', 'Heure_Fin', 'Heure_Validation', 'Statut', 'User_ID', 'Historique'] },
    { name: 'Compteurs', headers: ['Type', 'Date', 'Compteur'] } // v8.4: Pour ID standardisés
  ];
  
  requiredSheets.forEach(function(sheetInfo) {
    let sheet = ss.getSheetByName(sheetInfo.name);
    if (!sheet) {
      sheet = ss.insertSheet(sheetInfo.name);
      sheet.getRange(1, 1, 1, sheetInfo.headers.length).setValues([sheetInfo.headers]);
      sheet.getRange(1, 1, 1, sheetInfo.headers.length).setFontWeight('bold').setBackground('#1e40af').setFontColor('#ffffff');
      log.push('✅ ' + sheetInfo.name + ' créé');
    }
  });
  
  // Utilisateurs par défaut v8.4
  const usersSheet = ss.getSheetByName('Utilisateurs');
  if (usersSheet && usersSheet.getLastRow() <= 1) {
    usersSheet.appendRow(['admin', 'admin123', 'Administrateur', 'admin', 'Oui']);
    usersSheet.appendRow(['chef1', 'chef123', 'Chef Équipe 1', 'chef_equipe', 'Oui']); // v8.4 NEW
    usersSheet.appendRow(['tech1', 'tech123', 'Technicien 1', 'technicien', 'Oui']);
    usersSheet.appendRow(['op1', 'op123', 'Opérateur 1', 'operateur', 'Oui']);
    log.push('✅ Utilisateurs créés (admin, chef1, tech1, op1)');
  }
  
  // Exemples Descriptions_Anomalies
  const descSheet = ss.getSheetByName('Descriptions_Anomalies');
  if (descSheet && descSheet.getLastRow() <= 1) {
    const exemples = [
      ['Fuite', 'Fuite eau au niveau joint', 'Haute'],
      ['Fuite', 'Fuite huile sur vérin', 'Haute'],
      ['Fuite', 'Fuite air comprimé', 'Moyenne'],
      ['Bruit anormal', 'Bruit métallique répétitif', 'Moyenne'],
      ['Bruit anormal', 'Vibration excessive', 'Haute'],
      ['Blocage', 'Machine bloquée', 'Haute'],
      ['Défaut capteur', 'Capteur HS', 'Haute'],
      ['Surchauffe', 'Température élevée', 'Haute']
    ];
    exemples.forEach(row => descSheet.appendRow(row));
    log.push('✅ Descriptions exemples ajoutées');
  }
  
  SpreadsheetApp.getUi().alert('SETUP v8.4 TERMINÉ\n\n' + log.join('\n'));
  return { success: true, log: log };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  return json({ success: true, version: 'GMAO BAHIA v8.4' });
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    switch(p.action) {
      case 'login': return json(login(p));
      case 'getData': return json(getData());
      case 'getDescriptions': return json(getDescriptions(p.anomalie));
      case 'saveAnomalie': return json(saveAnomalie(p));
      case 'getAnomalies': return json(getAnomalies());
      case 'cloturerDI': return json(cloturerDI(p));
      case 'getBTs': return json(getBTs());
      case 'updateBTStatut': return json(updateBTStatut(p));
      case 'updateDI': return json(updateDI(p));
      case 'deleteDI': return json(deleteDI(p));
      default: return json({ success: false, error: 'Action inconnue' });
    }
  } catch(e) { return json({ success: false, error: e.toString() }); }
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES OPTIMISÉS
// ═══════════════════════════════════════════════════════════════════════════════

const cache = CacheService.getScriptCache();

function getSheet(name) { 
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); 
}

function sheetToArray(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

// v8.4: Génération ID standardisé JJMMAA-N
function generateId(type) {
  const now = new Date();
  const dateKey = Utilities.formatDate(now, 'GMT+1', 'ddMMyy');
  const sheet = getSheet('Compteurs');
  
  if (!sheet) {
    // Fallback si pas de feuille Compteurs
    return type + '-' + dateKey + '-1';
  }
  
  const data = sheet.getDataRange().getValues();
  let compteur = 1;
  let rowFound = -1;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === type && data[i][1] === dateKey) {
      compteur = parseInt(data[i][2]) + 1;
      rowFound = i + 1;
      break;
    }
  }
  
  if (rowFound > 0) {
    sheet.getRange(rowFound, 3).setValue(compteur);
  } else {
    sheet.appendRow([type, dateKey, compteur]);
  }
  
  return type + '-' + dateKey + '-' + compteur;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════

function login(p) {
  const users = sheetToArray(getSheet('Utilisateurs'));
  const user = users.find(u => 
    u.Identifiant === p.username && 
    u.MotDePasse === p.password && 
    (u.Actif === 'Oui' || u.Actif === true || u.Actif === 'TRUE' || u.Actif === 'true')
  );
  if (user) {
    return { success: true, user: { id: user.Identifiant, nom: user.Nom, role: user.Role } };
  }
  return { success: false, error: 'Identifiants incorrects' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET DATA - Optimisé (sans pièces)
// ═══════════════════════════════════════════════════════════════════════════════

function getData() {
  try {
    // v8.4: Techniciens groupés par fonction
    const techs = sheetToArray(getSheet('Techniciens'));
    
    return { 
      success: true,
      machines: sheetToArray(getSheet('Machines')),
      zones: sheetToArray(getSheet('Zones')),
      composants: sheetToArray(getSheet('Composants')),
      anomalies: sheetToArray(getSheet('Types_Anomalies')),
      techniciens: techs,
      descriptions: sheetToArray(getSheet('Descriptions_Anomalies')) // v8.4 NEW
    };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// v8.4: Descriptions par type d'anomalie
function getDescriptions(anomalie) {
  try {
    const all = sheetToArray(getSheet('Descriptions_Anomalies'));
    const filtered = anomalie ? all.filter(d => d.Type_Anomalie === anomalie) : all;
    return { success: true, data: filtered };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAVE ANOMALIE (DI) - v8.4 avec ID standardisé
// ═══════════════════════════════════════════════════════════════════════════════

function saveAnomalie(p) {
  try {
    const sheet = getSheet('Historique');
    if (!sheet) return { success: false, error: 'Onglet Historique non trouvé' };
    
    const now = new Date();
    const id = generateId('DI'); // v8.4: Format DI-JJMMAA-N
    const dateStr = Utilities.formatDate(now, 'GMT+1', 'dd/MM/yyyy');
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = sheet.getLastRow() + 1;
    
    const values = {
      'ID': id,
      'Date': dateStr,
      'Heure': p.heureSignal || Utilities.formatDate(now, 'GMT+1', 'HH:mm'), // v8.5: Heure signalement
      'Heure_Arrivee_Maint': p.heureFinOp || '', // v8.5: Heure arrivée maintenance (saisie opérateur)
      'Operateur': p.operateur || '',
      'Ligne': p.ligne || '',
      'Machine': p.machine || '',
      'Zone': p.zone || '',
      'Composant': p.composant || '',
      'Anomalie': p.anomalie || '',
      'Description': p.description || '',
      'Techniciens': p.techniciens || '',
      'Commentaire': p.commentaire || '',
      'Photo': p.photo || '',
      'Statut': 'En attente',
      'User_ID': p.userId || '',
      'BT_ID': ''
    };
    
    // Écriture batch optimisée
    const rowData = headers.map(h => values[h] !== undefined ? values[h] : '');
    sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
    
    return { success: true, id: id };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET ANOMALIES (DI)
// ═══════════════════════════════════════════════════════════════════════════════

function getAnomalies() {
  try {
    const data = sheetToArray(getSheet('Historique'));
    data.sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
    return { success: true, data: data };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function parseDate(d) {
  if (!d) return new Date(0);
  const p = d.split('/');
  return p.length === 3 ? new Date(p[2], p[1]-1, p[0]) : new Date(0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLOTURER DI - v8.4 avec BT lié (même numéro)
// ═══════════════════════════════════════════════════════════════════════════════

function cloturerDI(p) {
  try {
    const histSheet = getSheet('Historique');
    const btSheet = getSheet('Bons_Travail');
    if (!histSheet || !btSheet) return { success: false, error: 'Onglets manquants' };
    
    // Trouver la DI
    const histData = histSheet.getDataRange().getValues();
    const histHeaders = histData[0];
    let diRow = -1, diData = null;
    
    for (let i = 1; i < histData.length; i++) {
      if (histData[i][0] === p.diId) {
        diRow = i + 1;
        diData = {};
        histHeaders.forEach((h, idx) => diData[h] = histData[i][idx]);
        break;
      }
    }
    if (diRow < 0) return { success: false, error: 'DI non trouvée' };
    
    // v8.4: BT avec même numéro que DI (DI-020126-1 → BT-020126-1)
    const diNum = p.diId.replace('DI-', '');
    const btId = 'BT-' + diNum;
    
    const now = new Date();
    const dateStr = Utilities.formatDate(now, 'GMT+1', 'dd/MM/yyyy');
    const heureStr = Utilities.formatDate(now, 'GMT+1', 'HH:mm');
    
    const btHeaders = btSheet.getRange(1, 1, 1, btSheet.getLastColumn()).getValues()[0];
    const newRow = btSheet.getLastRow() + 1;
    
    const btValues = {
      'BT_ID': btId,
      'Date': dateStr,
      'Heure': heureStr,
      'Anomalie_ID': p.diId,
      'Technicien': p.technicien || '',
      'Cause': p.cause || '',
      'Diagnostic': p.diagnostic || '',
      'Action_Type': p.actionType || '',
      'Action_Detail': p.actionDetail || '',
      'Pieces': JSON.stringify(p.pieces || []),
      'Duree': diData.Duree || 0,
      'Statut': 'En cours',
      'User_ID': p.userId || '',
      'Historique': JSON.stringify([{ date: dateStr + ' ' + heureStr, statut: 'En cours', user: p.technicien }])
    };
    
    // Écriture batch
    const rowData = btHeaders.map(h => btValues[h] !== undefined ? btValues[h] : '');
    btSheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
    
    // MAJ DI
    const statutCol = histHeaders.indexOf('Statut') + 1;
    const btIdCol = histHeaders.indexOf('BT_ID') + 1;
    if (statutCol > 0) histSheet.getRange(diRow, statutCol).setValue('Clôturé');
    if (btIdCol > 0) histSheet.getRange(diRow, btIdCol).setValue(btId);
    
    return { success: true, btId: btId };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET BTs
// ═══════════════════════════════════════════════════════════════════════════════

function getBTs() {
  try {
    const btSheet = getSheet('Bons_Travail');
    const histSheet = getSheet('Historique');
    if (!btSheet) return { success: false, error: 'Onglet BT non trouvé' };
    
    let bts = sheetToArray(btSheet);
    
    // Enrichir avec infos DI
    if (histSheet) {
      const dis = sheetToArray(histSheet);
      const diMap = {};
      dis.forEach(di => diMap[di.ID] = di);
      
      bts = bts.map(bt => {
        const di = diMap[bt.Anomalie_ID];
        if (di) {
          bt.Machine = di.Machine;
          bt.Ligne = di.Ligne;
          bt.Zone = di.Zone;
          bt.Anomalie = di.Anomalie;
        }
        return bt;
      });
    }
    
    bts.sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
    return { success: true, data: bts };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE BT STATUT - v8.4 (Chef équipe seul peut valider)
// ═══════════════════════════════════════════════════════════════════════════════

function updateBTStatut(p) {
  try {
    const sheet = getSheet('Bons_Travail');
    if (!sheet) return { success: false, error: 'Onglet BT non trouvé' };
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Trouver BT
    let btRow = -1;
    const btIdCol = headers.indexOf('BT_ID');
    for (let i = 1; i < data.length; i++) {
      if (data[i][btIdCol] === p.btId) { btRow = i + 1; break; }
    }
    if (btRow < 0) return { success: false, error: 'BT non trouvé' };
    
    // MAJ statut
    const statutCol = headers.indexOf('Statut');
    if (statutCol >= 0) sheet.getRange(btRow, statutCol + 1).setValue(p.newStatut);
    
    // MAJ horaires si Terminé (technicien)
    if (p.newStatut === 'Terminé') {
      const heureArriveeCol = headers.indexOf('Heure_Arrivee');
      const heureFinCol = headers.indexOf('Heure_Fin');
      if (heureArriveeCol >= 0 && p.heureArrivee) sheet.getRange(btRow, heureArriveeCol + 1).setValue(p.heureArrivee);
      if (heureFinCol >= 0 && p.heureFin) sheet.getRange(btRow, heureFinCol + 1).setValue(p.heureFin);
    }
    
    // MAJ heure validation si Validé (chef équipe)
    if (p.newStatut === 'Validé') {
      const heureValidCol = headers.indexOf('Heure_Validation');
      if (heureValidCol >= 0) {
        const now = new Date();
        const heureValid = p.heureValidation || Utilities.formatDate(now, 'GMT+1', 'HH:mm');
        sheet.getRange(btRow, heureValidCol + 1).setValue(heureValid);
      }
    }
    
    // MAJ historique
    const histCol = headers.indexOf('Historique');
    if (histCol >= 0) {
      let hist = [];
      try { hist = JSON.parse(data[btRow-1][histCol] || '[]'); } catch(e) {}
      const now = new Date();
      const entry = {
        date: Utilities.formatDate(now, 'GMT+1', 'dd/MM/yyyy HH:mm'),
        statut: p.newStatut,
        user: p.userName || '',
        comment: p.comment || ''
      };
      if (p.newStatut === 'Terminé') {
        entry.heureArrivee = p.heureArrivee || '';
        entry.heureFin = p.heureFin || '';
      }
      if (p.newStatut === 'Validé') {
        entry.heureValidation = p.heureValidation || '';
      }
      hist.push(entry);
      sheet.getRange(btRow, histCol + 1).setValue(JSON.stringify(hist));
    }
    
    return { success: true };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE DI
// ═══════════════════════════════════════════════════════════════════════════════

function updateDI(p) {
  try {
    const sheet = getSheet('Historique');
    if (!sheet) return { success: false, error: 'Onglet non trouvé' };
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    let rowNum = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === p.diId) { rowNum = i + 1; break; }
    }
    if (rowNum < 0) return { success: false, error: 'DI non trouvée' };
    
    // Vérifier statut
    const statutIdx = headers.indexOf('Statut');
    if (statutIdx >= 0 && data[rowNum-1][statutIdx] !== 'En attente') {
      return { success: false, error: 'DI déjà clôturée' };
    }
    
    const updates = { 'Ligne': p.ligne, 'Machine': p.machine, 'Zone': p.zone, 'Composant': p.composant, 'Anomalie': p.anomalie, 'Description': p.description, 'Commentaire': p.commentaire };
    
    for (const [col, val] of Object.entries(updates)) {
      const idx = headers.indexOf(col);
      if (idx >= 0 && val !== undefined) sheet.getRange(rowNum, idx + 1).setValue(val);
    }
    
    return { success: true };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE DI
// ═══════════════════════════════════════════════════════════════════════════════

function deleteDI(p) {
  try {
    const sheet = getSheet('Historique');
    if (!sheet) return { success: false, error: 'Onglet non trouvé' };
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    let rowNum = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === p.diId) { rowNum = i + 1; break; }
    }
    if (rowNum < 0) return { success: false, error: 'DI non trouvée' };
    
    const statutIdx = headers.indexOf('Statut');
    if (statutIdx >= 0 && data[rowNum-1][statutIdx] !== 'En attente') {
      return { success: false, error: 'Impossible supprimer DI clôturée' };
    }
    
    sheet.deleteRow(rowNum);
    return { success: true };
  } catch(e) { return { success: false, error: e.toString() }; }
}
