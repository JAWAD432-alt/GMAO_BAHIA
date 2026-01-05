const API_URL = 'https://script.google.com/macros/s/AKfycbzHFfqVy8IjBdTuvpNl8ZroiqRGl0RjKP02PuavATN9U13Z18ZDyELFDIIkAUcdZ00K/exec';
let user = null, db = { machines: [], zones: [], composants: [], anomalies: [], techniciens: [], descriptions: [] };
let allDI = [], allBT = [], signalData = { ligne: '', machine: '', zone: '', composant: '', anomalie: '', description: '', techniciens: [] };
let currentDI = null, currentBT = null, photoData = null;
let notifications = [], lastDICount = 0, lastBTCount = 0;
let swRegistration = null;

document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(console.error);
        navigator.serviceWorker.addEventListener('message', e => {
            if (e.data && e.data.type === 'notification-click') {
                const { notifType, refId } = e.data;
                if (notifType === 'di' && refId) openDIDetail(refId);
                else if ((notifType === 'bt' || notifType === 'statut') && refId) openBTDetail(refId);
            }
        });
    }

    const saved = localStorage.getItem('gmao_user');
    if (saved) {
        try {
            user = JSON.parse(saved);
            showApp();
        } catch (e) {
            localStorage.removeItem('gmao_user');
        }
    }

    // Charger notifications sauvegardées
    const savedNotifs = localStorage.getItem('gmao_notifications');
    if (savedNotifs) {
        try { notifications = JSON.parse(savedNotifs); } catch (e) { }
    }

    // Event Listeners
    document.getElementById('btnLogin').onclick = doLogin;
    document.getElementById('loginPass').onkeypress = e => { if (e.key === 'Enter') doLogin(); };
    document.getElementById('btnRefresh').onclick = () => { loadAllData(); toast('🔄 Actualisé'); };
    document.getElementById('btnLogout').onclick = doLogout;
    document.getElementById('btnSaveDI').onclick = saveDI;
    document.getElementById('btnWhatsApp').onclick = sendWhatsApp;
    document.getElementById('commentInput').oninput = updatePreview;
    document.getElementById('descriptionSelect').onchange = () => { showStep(8); updatePreview(); };
    document.getElementById('searchBT').oninput = () => renderBTList(document.getElementById('searchBT').value);
    document.getElementById('searchHistDI').oninput = renderHistoriqueDI;
    document.getElementById('searchHistBT').oninput = renderHistoriqueBT;
    document.getElementById('btnCloseDI').onclick = closeDI;
    document.getElementById('btnSaveStatut').onclick = saveNewStatut;
    document.getElementById('btnTakePhoto').onclick = () => document.getElementById('photoInput').click();
    document.getElementById('photoInput').onchange = handlePhoto;
    document.getElementById('btnRemovePhoto').onclick = removePhoto;

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const page = btn.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.action-bar').forEach(a => a.classList.remove('show'));
            document.getElementById(page).classList.add('active');
            btn.classList.add('active');
            if (page === 'pageSignal') document.getElementById('signalActionBar').classList.add('show');
            if (page === 'pageHistorique') { renderHistoriqueDI(); renderHistoriqueBT(); }
            if (page === 'pageValidation') renderBTToValidate();
        };
    });

    // Tabs
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
        btn.onclick = () => {
            const parent = btn.closest('.page'), tab = btn.dataset.tab;
            parent.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            if (tab === 'new') { document.getElementById('tabSignalNew').classList.add('active'); document.getElementById('signalActionBar').classList.add('show'); }
            else if (tab === 'history') { document.getElementById('tabSignalHistory').classList.add('active'); document.getElementById('signalActionBar').classList.remove('show'); renderMyDIs(); }
            else if (tab === 'di') document.getElementById('tabMaintDI').classList.add('active');
            else if (tab === 'bt') document.getElementById('tabMaintBT').classList.add('active');
            else if (tab === 'histDI') { document.getElementById('tabHistDI').classList.add('active'); renderHistoriqueDI(); }
            else if (tab === 'histBT') { document.getElementById('tabHistBT').classList.add('active'); renderHistoriqueBT(); }
        };
    });

    document.querySelectorAll('.modal').forEach(m => m.onclick = e => { if (e.target === m) m.classList.remove('show'); });
});

async function api(action, params = {}) {
    try {
        const c = new AbortController(), t = setTimeout(() => c.abort(), 10000);
        const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, ...params }), signal: c.signal });
        clearTimeout(t); return await r.json();
    }
    catch (e) { return { success: false, error: e.name === 'AbortError' ? 'Timeout' : e.message }; }
}

async function doLogin() {
    const username = document.getElementById('loginUser').value.trim(), password = document.getElementById('loginPass').value.trim();
    const errorEl = document.getElementById('loginError');
    if (!username || !password) { errorEl.textContent = 'Remplir tous les champs'; errorEl.style.display = 'block'; return; }
    errorEl.style.display = 'none';
    const btn = document.getElementById('btnLogin'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    const result = await api('login', { username, password });
    if (result.success) { user = result.user; localStorage.setItem('gmao_user', JSON.stringify(user)); showApp(); }
    else { errorEl.textContent = result.error || 'Erreur'; errorEl.style.display = 'block'; }
    btn.disabled = false; btn.textContent = '🚀 Connexion';
}

function doLogout() { if (confirm('Déconnexion?')) { user = null; localStorage.removeItem('gmao_user'); document.getElementById('loginPage').style.display = 'flex'; document.getElementById('mainApp').classList.remove('active'); } }

async function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').classList.add('active');
    document.getElementById('userAvatar').textContent = user.nom.charAt(0).toUpperCase();
    document.getElementById('userName').textContent = user.nom;
    document.getElementById('userRole').textContent = user.role;
    document.getElementById('opName').textContent = user.nom;
    applyRoleRestrictions(); await loadData();
    setInterval(() => { loadAllData(); }, 60000);
    updateNotifBadge();
    initPushNotifications();
}

function applyRoleRestrictions() {
    const role = (user.role || '').toLowerCase();
    const navSignal = document.getElementById('navSignal');
    const navMaint = document.getElementById('navMaint');
    const navHistorique = document.getElementById('navHistorique');
    const navValidation = document.getElementById('navValidation');
    navSignal.style.display = 'flex';
    navMaint.style.display = 'flex';
    navHistorique.style.display = 'flex';
    navValidation.style.display = 'none';
    if (role === 'technicien') {
        navSignal.style.display = 'none';
    } else if (role === 'chef_equipe' || role === 'chef equipe') {
        navMaint.style.display = 'none';
        navValidation.style.display = 'flex';
    } else if (role === 'operateur' || role === 'opérateur') {
        navMaint.style.display = 'none';
    }
}

async function loadData() {
    setStatus(false, 'Chargement...');
    const result = await api('getData');
    if (result.success) { db = result; setStatus(true, 'Connecté'); initSignalForm(); await loadAllData(); }
    else { setStatus(false, 'Erreur'); toast('❌ Erreur connexion'); }
}

async function loadAllData() {
    console.log('loadAllData appelé');
    const [diResult, btResult] = await Promise.all([api('getAnomalies'), api('getBTs')]);
    if (diResult.success) { allDI = diResult.data || []; }
    if (btResult.success) { allBT = btResult.data || []; }
    updateDashboard(); renderDIList(); renderBTList(); renderMyDIs(); renderHistoriqueDI(); renderHistoriqueBT();
    checkForNewItems();
    updateNotifBadge();
}

function setStatus(online, text) { document.getElementById('statusDot').className = 'status-dot' + (online ? ' online' : ''); document.getElementById('statusText').textContent = text; }

function updateDashboard() {
    const diWaiting = allDI.filter(d => d.Statut === 'En attente').length;
    const btEnCours = allBT.filter(b => b.Statut === 'En cours').length;
    const btTermine = allBT.filter(b => b.Statut === 'Terminé').length;
    const btTotal = allBT.length;
    document.getElementById('statDI').textContent = diWaiting;
    document.getElementById('statBT').textContent = btEnCours;
    document.getElementById('statTermine').textContent = btTermine;
    document.getElementById('diWaitingCount').textContent = diWaiting;
    document.getElementById('myDICount').textContent = allDI.filter(d => d.Operateur === user.nom).length;
    const btCountEl = document.getElementById('btCount');
    if (btCountEl) btCountEl.textContent = btTotal;
    const maintBadge = document.getElementById('navMaintBadge');
    if (maintBadge) {
        maintBadge.textContent = diWaiting;
        if (diWaiting > 0) { maintBadge.classList.add('show'); } else { maintBadge.classList.remove('show'); }
    }
    const validBadge = document.getElementById('navValidBadge');
    if (validBadge) {
        validBadge.textContent = btTermine;
        if (btTermine > 0) { validBadge.classList.add('show'); } else { validBadge.classList.remove('show'); }
    }
    calculateKPIs();
    renderRecentActivity();
}

function renderRecentActivity() {
    const recentDI = [...allDI].sort((a, b) => parseDate(b.Date) - parseDate(a.Date)).slice(0, 5);
    if (recentDI.length) {
        document.getElementById('recentDIList').innerHTML = recentDI.map(di => {
            const statut = di.Statut || '';
            const statutClass = statut === 'En attente' ? 'waiting' : 'done';
            return `<div style="padding:10px;background:#fff;border-radius:10px;margin-bottom:8px;border-left:3px solid ${statut === 'En attente' ? 'var(--danger)' : 'var(--success)'}; cursor:pointer" onclick="openDIDetail('${di.ID}')">
<div style="display:flex;justify-content:space-between;align-items:center">
<div style="font-weight:600;font-size:13px;color:var(--danger)">${di.ID}</div>
<span class="di-badge ${statutClass}" style="font-size:9px;padding:2px 6px">${statut}</span>
</div>
<div style="font-size:11px;color:var(--gray-500);margin-top:4px">${di.Machine || '-'}</div>
<div style="font-size:10px;color:var(--gray-400)">${di.Date || ''} ${di.Heure || ''}</div>
${di.BT_ID ? `<div style="font-size:10px;color:var(--warning);margin-top:4px">→ ${di.BT_ID}</div>` : ''}
</div>`;
        }).join('');
    } else {
        document.getElementById('recentDIList').innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400);font-size:12px">Aucune DI</div>';
    }

    const recentBT = [...allBT].sort((a, b) => parseDate(b.Date) - parseDate(a.Date)).slice(0, 5);
    if (recentBT.length) {
        document.getElementById('recentBTList').innerHTML = recentBT.map(bt => {
            const statut = bt.Statut || 'En cours';
            const statutColor = statut === 'Validé' ? 'var(--success)' : statut === 'Terminé' ? '#059669' : statut === 'En attente pièces' ? 'var(--warning)' : 'var(--primary)';
            return `<div style="padding:10px;background:#fff;border-radius:10px;margin-bottom:8px;border-left:3px solid ${statutColor}; cursor:pointer" onclick="openBTDetail('${bt.BT_ID}')">
<div style="display:flex;justify-content:space-between;align-items:center">
<div style="font-weight:600;font-size:13px;color:var(--warning)">${bt.BT_ID}</div>
<span class="bt-statut ${getStatutClass(statut)}" style="font-size:9px;padding:2px 6px">${statut}</span>
</div>
<div style="font-size:11px;color:var(--gray-500);margin-top:4px">${bt.Machine || '-'}</div>
<div style="font-size:10px;color:var(--gray-400)">${bt.Date || ''} ${bt.Heure || ''}</div>
${bt.Duree ? `<div style="font-size:10px;color:var(--primary);margin-top:4px">⏱️ ${bt.Duree} min</div>` : ''}
</div>`;
        }).join('');
    } else {
        document.getElementById('recentBTList').innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400);font-size:12px">Aucun BT</div>';
    }
}

function calculateKPIs() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const btWithTime = allBT.filter(bt => {
        const btDate = parseDate(bt.Date);
        return btDate >= thirtyDaysAgo && bt.Heure_Arrivee && bt.Heure_Fin;
    });

    const nbPannes = allDI.filter(di => parseDate(di.Date) >= thirtyDaysAgo).length;
    document.getElementById('kpiNbPannes').textContent = nbPannes;

    if (btWithTime.length === 0) {
        document.getElementById('kpiMTBF').textContent = '--';
        document.getElementById('kpiMTTR').textContent = '--';
        document.getElementById('kpiDispo').textContent = '--';
        return;
    }

    let totalRepairTime = 0;
    btWithTime.forEach(bt => {
        const arrival = parseTime(bt.Heure_Arrivee);
        const end = parseTime(bt.Heure_Fin);
        if (arrival && end) {
            let diff = (end - arrival) / 60000;
            if (diff < 0) diff += 24 * 60;
            totalRepairTime += diff;
        }
    });
    const mttr = btWithTime.length > 0 ? Math.round(totalRepairTime / btWithTime.length) : 0;
    document.getElementById('kpiMTTR').textContent = mttr;

    const hoursInPeriod = 30 * 24;
    const mtbf = nbPannes > 0 ? Math.round(hoursInPeriod / nbPannes) : hoursInPeriod;
    document.getElementById('kpiMTBF').textContent = mtbf;

    const mttrHours = mttr / 60;
    const dispo = mtbf > 0 ? Math.round((mtbf / (mtbf + mttrHours)) * 100) : 100;
    document.getElementById('kpiDispo').textContent = dispo + '%';
}

function parseTime(timeStr) {
    if (!timeStr) return null;
    const parts = String(timeStr).split(':');
    if (parts.length >= 2) {
        const d = new Date();
        d.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
        return d;
    }
    return null;
}

function parseDate(d) {
    if (!d) return new Date(0);
    if (d instanceof Date) return d;
    if (typeof d === 'number') return new Date(d);
    if (typeof d === 'string') {
        const p = d.split('/');
        if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]);
        return new Date(d);
    }
    return new Date(0);
}

function initSignalForm() {
    const lignes = [...new Set((db.machines || []).map(m => m.Ligne).filter(Boolean))];
    document.getElementById('lignesChips').innerHTML = lignes.map(l => `<div class="chip" onclick="selectLigne(this)" data-value="${l}">${l}</div>`).join('');
    const techsByFonction = {};
    (db.techniciens || []).forEach(t => { const f = t.Fonction || 'Autres'; if (!techsByFonction[f]) techsByFonction[f] = []; techsByFonction[f].push(t); });
    let techHTML = '';
    Object.entries(techsByFonction).forEach(([fonction, techs]) => {
        techHTML += `<div class="tech-group"><div class="tech-group-title">${fonction}</div><div class="tech-grid">`;
        techHTML += techs.map(t => `<div class="tech-item" onclick="toggleTech(this)" data-name="${t.Nom}"><input type="checkbox"><span class="tech-name">${t.Nom}</span></div>`).join('');
        techHTML += '</div></div>';
    });
    document.getElementById('techsContainer').innerHTML = techHTML;
    document.getElementById('anomaliesChips').innerHTML = (db.anomalies || []).map(a => `<div class="chip" onclick="selectAnomalie(this)" data-value="${a.Anomalie}">${a.Anomalie}</div>`).join('');
    resetSignalForm();
}

function selectLigne(chip) {
    document.querySelectorAll('#lignesChips .chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    signalData.ligne = chip.dataset.value;
    signalData.machine = ''; signalData.zone = ''; signalData.composant = ''; signalData.anomalie = '';
    hideSteps([3, 4, 5, 6, 7, 8, 9, 10]);
    document.getElementById('previewCard').classList.add('hidden');
    const machines = (db.machines || []).filter(m => m.Ligne === signalData.ligne);
    document.getElementById('machinesChips').innerHTML = machines.map(m => `<div class="chip" onclick="selectMachine(this)" data-value="${m.Machine}">${m.Machine}</div>`).join('');
    showStep(3);
    updatePreview();
}

function selectMachine(chip) {
    document.querySelectorAll('#machinesChips .chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    signalData.machine = chip.dataset.value;
    signalData.zone = ''; signalData.composant = ''; signalData.anomalie = '';
    hideSteps([4, 5, 6, 7, 8, 9, 10]);
    document.getElementById('previewCard').classList.add('hidden');
    const zones = (db.zones || []).filter(z => z.Machine === signalData.machine);
    document.getElementById('zonesChips').innerHTML = zones.map(z => `<div class="chip" onclick="selectZone(this)" data-value="${z.Zone}">${z.Zone}</div>`).join('');
    showStep(4);
    updatePreview();
}

function selectZone(chip) {
    document.querySelectorAll('#zonesChips .chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    signalData.zone = chip.dataset.value;
    signalData.composant = ''; signalData.anomalie = '';
    hideSteps([5, 6, 7, 8, 9, 10]);
    document.getElementById('previewCard').classList.add('hidden');
    const composants = (db.composants || []).filter(c => c.Zone === signalData.zone);
    document.getElementById('composantsChips').innerHTML = composants.map(c => `<div class="chip" onclick="selectComposant(this)" data-value="${c.Composant}">${c.Composant}</div>`).join('');
    showStep(5);
    updatePreview();
}

function selectComposant(chip) {
    document.querySelectorAll('#composantsChips .chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    signalData.composant = chip.dataset.value;
    signalData.anomalie = '';
    hideSteps([6, 7, 8, 9, 10]);
    document.getElementById('previewCard').classList.add('hidden');
    showStep(6);
    updatePreview();
}

function selectAnomalie(chip) {
    document.querySelectorAll('#anomaliesChips .chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    signalData.anomalie = chip.dataset.value;
    const descriptions = (db.descriptions || []).filter(d => d.Type_Anomalie === signalData.anomalie);
    const select = document.getElementById('descriptionSelect');
    select.innerHTML = '<option value="">-- Sélectionner --</option>' + descriptions.map(d => `<option value="${d.Description_Standard}">${d.Description_Standard}</option>`).join('');
    showStep(7); showStep(8); showStep(9); showStep(10);
    document.getElementById('previewCard').classList.remove('hidden');
    updatePreview();
}

function toggleTech(item) {
    const cb = item.querySelector('input'); cb.checked = !cb.checked;
    item.classList.toggle('selected', cb.checked);
    const name = item.dataset.name;
    if (cb.checked) { if (!signalData.techniciens.includes(name)) signalData.techniciens.push(name); }
    else { signalData.techniciens = signalData.techniciens.filter(t => t !== name); }
    updatePreview();
}

function showStep(n) { document.getElementById('step' + n).classList.remove('hidden'); }
function hideSteps(arr) { arr.forEach(n => { const el = document.getElementById('step' + n); if (el) el.classList.add('hidden'); }); }

function updatePreview() {
    signalData.description = document.getElementById('descriptionSelect').value;
    const comment = document.getElementById('commentInput').value;
    const heureSignal = document.getElementById('heureSignal').value;
    const heureFinOp = document.getElementById('heureFinOp').value;
    let msg = `🚨 *DEMANDE D'INTERVENTION*\n━━━━━━━━━━━━━━━━━━\n👤 ${user.nom}\n`;
    if (heureSignal) msg += `🕐 Heure signalement: ${heureSignal}\n`;
    if (heureFinOp) msg += `🕐 Arrivée maintenance: ${heureFinOp}\n`;
    if (signalData.ligne) msg += `📍 Ligne: ${signalData.ligne}\n`;
    if (signalData.machine) msg += `⚙️ Machine: ${signalData.machine}\n`;
    if (signalData.zone) msg += `🔧 Zone: ${signalData.zone}\n`;
    if (signalData.composant) msg += `🔩 Composant: ${signalData.composant}\n`;
    if (signalData.anomalie) msg += `⚠️ Anomalie: ${signalData.anomalie}\n`;
    if (signalData.description) msg += `📝 ${signalData.description}\n`;
    if (signalData.techniciens.length) msg += `👨‍🔧 Techniciens: ${signalData.techniciens.join(', ')}\n`;
    if (comment) msg += `💬 ${comment}\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n⏳ En attente`;
    document.getElementById('previewBox').textContent = msg;
    const valid = signalData.ligne && signalData.machine && signalData.zone && signalData.composant && signalData.anomalie;
    document.getElementById('btnSaveDI').disabled = !valid;
    document.getElementById('btnWhatsApp').disabled = !valid;
}

function resetSignalForm() {
    signalData = { ligne: '', machine: '', zone: '', composant: '', anomalie: '', description: '', techniciens: [] };
    document.querySelectorAll('#tabSignalNew .chip').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('#techsContainer .tech-item').forEach(t => { t.classList.remove('selected'); t.querySelector('input').checked = false; });
    document.getElementById('commentInput').value = ''; document.getElementById('descriptionSelect').value = '';
    document.getElementById('heureSignal').value = ''; document.getElementById('heureFinOp').value = '';
    hideSteps([3, 4, 5, 6, 7, 8, 9, 10]); document.getElementById('previewCard').classList.add('hidden');
    document.getElementById('successBox').classList.add('hidden');[1, 2].forEach(n => document.getElementById('step' + n).classList.remove('hidden'));
    removePhoto(); updatePreview();
}

function handlePhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        photoData = ev.target.result;
        document.getElementById('photoImg').src = photoData;
        document.getElementById('photoPreview').classList.remove('hidden');
        document.getElementById('btnTakePhoto').classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function removePhoto() { photoData = null; document.getElementById('photoPreview').classList.add('hidden'); document.getElementById('btnTakePhoto').classList.remove('hidden'); document.getElementById('photoInput').value = ''; }

async function saveDI() {
    let heureSignal = document.getElementById('heureSignal').value;
    const heureFinOp = document.getElementById('heureFinOp').value;
    if (!heureSignal) {
        const now = new Date();
        heureSignal = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        document.getElementById('heureSignal').value = heureSignal;
    }
    const btn = document.getElementById('btnSaveDI'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    const result = await api('saveAnomalie', { operateur: user.nom, ligne: signalData.ligne, machine: signalData.machine, zone: signalData.zone, composant: signalData.composant, anomalie: signalData.anomalie, description: signalData.description, techniciens: signalData.techniciens.join(', '), heureSignal: heureSignal, heureFinOp: heureFinOp || '', commentaire: document.getElementById('commentInput').value, userId: user.id, photo: photoData || '' });
    if (result.success) {
        document.getElementById('successId').textContent = result.id;
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(n => { const el = document.getElementById('step' + n); if (el) el.classList.add('hidden'); });
        document.getElementById('previewCard').classList.add('hidden');
        document.getElementById('successBox').classList.remove('hidden');
        btn.innerHTML = '➕ Nouveau'; btn.disabled = false;
        btn.onclick = () => { resetSignalForm(); btn.innerHTML = '💾 Enregistrer'; btn.onclick = saveDI; };
        toast('✅ DI enregistrée! Envoyez WhatsApp'); await loadAllData();
    }
    else { toast('❌ ' + (result.error || 'Erreur')); btn.innerHTML = '💾 Enregistrer'; btn.disabled = false; }
}

function sendWhatsApp() { window.open('https://wa.me/?text=' + encodeURIComponent(document.getElementById('previewBox').textContent), '_blank'); }

function canEditDI(di) {
    const role = (user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrateur';
    const isOwner = di.Operateur && user.nom && di.Operateur.trim().toLowerCase() === user.nom.trim().toLowerCase();
    const notProcessed = di.Statut === 'En attente';
    if (isAdmin) return true;
    if ((role === 'operateur' || role === 'opérateur' || role === 'chef_equipe' || role === 'chef equipe') && isOwner && notProcessed) return true;
    return false;
}

function canDeleteDI(di) {
    const role = (user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrateur';
    const isOwner = di.Operateur && user.nom && di.Operateur.trim().toLowerCase() === user.nom.trim().toLowerCase();
    const notProcessed = di.Statut === 'En attente';
    if (isAdmin) return true;
    if ((role === 'operateur' || role === 'opérateur' || role === 'chef_equipe' || role === 'chef equipe') && isOwner && notProcessed) return true;
    return false;
}

function canEditBT(bt) {
    const role = (user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrateur';
    const notValidated = bt.Statut !== 'Validé';
    if (isAdmin) return true;
    if (role === 'technicien' && notValidated) return true;
    return false;
}

function canDeleteBT(bt) {
    const role = (user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrateur';
    return isAdmin;
}

function renderMyDIs() {
    const myDIs = allDI.filter(di => {
        const match = di.Operateur && user.nom && di.Operateur.trim().toLowerCase() === user.nom.trim().toLowerCase();
        return match;
    });
    if (!myDIs.length) { document.getElementById('myDIList').innerHTML = '<div class="list-empty"><div class="empty-icon">📭</div>Aucun signalement</div>'; return; }
    document.getElementById('myDIList').innerHTML = myDIs.map(di => {
        const canEdit = canEditDI(di);
        const canDelete = canDeleteDI(di);
        const showActions = canEdit || canDelete;
        return `<div class="di-card ${di.Statut === 'Clôturé' ? 'done' : ''}" onclick="openDIDetail('${di.ID}')">
<div class="di-header"><div><div class="di-id">${di.ID}</div><div class="di-date">${di.Date || ''}</div></div>
<span class="di-badge ${di.Statut === 'En attente' ? 'waiting' : 'done'}">${di.Statut}</span></div>
<div class="di-machine">⚙️ ${di.Machine || '-'}</div>
<div class="di-info">📍 ${di.Ligne || '-'} | 🔧 ${di.Zone || '-'}</div>
${di.BT_ID ? `<div class="di-info" style="color:var(--warning)">→ ${di.BT_ID}</div>` : ''}
${showActions ? `<div class="di-actions">
${canEdit ? `<button class="di-btn warning" onclick="event.stopPropagation();openEditDI('${di.ID}')">✏️ Éditer</button>` : ''}
${canDelete ? `<button class="di-btn" style="background:var(--danger);color:#fff" onclick="event.stopPropagation();confirmDeleteDI('${di.ID}')">🗑️</button>` : ''}
</div>` : ''}
</div>`;
    }).join('');
}

function renderDIList() {
    const waiting = allDI.filter(di => di.Statut === 'En attente');
    if (!waiting.length) {
        document.getElementById('diWaitingList').innerHTML = '<div class="list-empty"><div class="empty-icon">✅</div>Aucune DI en attente</div>';
        return;
    }
    document.getElementById('diWaitingList').innerHTML = waiting.map(di => `
<div class="di-card" onclick="openDIDetail('${di.ID}')">
<div class="di-header"><div><div class="di-id">${di.ID}</div><div class="di-date">${di.Date || ''}</div></div>
<span class="di-badge waiting">En attente</span></div>
<div class="di-machine">⚙️ ${di.Machine || '-'}</div>
<div class="di-info">📍 ${di.Ligne || '-'} | 🔧 ${di.Zone || '-'}</div>
<div class="di-info">⚠️ ${di.Anomalie || '-'}</div>
<div class="di-info">👤 ${di.Operateur || '-'}</div>
<div class="di-actions">
<button class="di-btn primary" onclick="event.stopPropagation();startIntervention('${di.ID}')">▶️ Prendre en charge</button>
</div>
</div>`).join('');
}

async function startIntervention(diId) {
    if (!confirm('Démarrer l\'intervention maintenant ?\nCela créera un BT "En cours" et marquera votre heure d\'arrivée.')) return;
    
    // Create BT with "In Progress" placeholder data
    const result = await api('cloturerDI', { 
        diId: diId, 
        technicien: user.nom, 
        cause: "Intervention démarrée", 
        diagnostic: "En cours de diagnostic", 
        actionType: "Correctif", 
        actionDetail: "Prise en charge par " + user.nom, 
        pieces: "", 
        userId: user.id 
    });

    if (result.success) {
        toast('✅ Intervention démarrée (BT: ' + result.btId + ')');
        // Force status to "En cours" and set Arrival Time
        const now = new Date();
        const heureArrivee = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        
        await api('updateBTStatut', { 
            btId: result.btId, 
            newStatut: 'En cours', 
            comment: 'Début intervention', 
            userName: user.nom,
            heureArrivee: heureArrivee
        });
        await loadAllData();
    } else {
        toast('❌ ' + (result.error || 'Erreur'));
    }
}


function renderHistoriqueDI() {
    const search = (document.getElementById('searchHistDI').value || '').toLowerCase();
    let dis = [...allDI];
    if (search) { dis = dis.filter(d => (d.ID || '').toLowerCase().includes(search) || (d.Machine || '').toLowerCase().includes(search)); }
    if (!dis.length) {
        document.getElementById('histDIList').innerHTML = '<div class="list-empty"><div class="empty-icon">📭</div>Aucune DI</div>';
        return;
    }
    document.getElementById('histDIList').innerHTML = dis.map(di => `
<div class="di-card ${di.Statut === 'Clôturé' ? 'done' : ''}" onclick="openDIDetail('${di.ID}')">
<div class="di-header"><div><div class="di-id">${di.ID}</div><div class="di-date">${di.Date || ''}</div></div>
<span class="di-badge ${di.Statut === 'En attente' ? 'waiting' : 'done'}">${di.Statut || '-'}</span></div>
<div class="di-machine">⚙️ ${di.Machine || '-'}</div>
<div class="di-info">📍 ${di.Ligne || '-'} | ⚠️ ${di.Anomalie || '-'}</div>
${di.BT_ID ? `<div class="di-info" style="color:var(--warning)">→ ${di.BT_ID}</div>` : ''}
</div>`).join('');
}

function openDIDetail(diId) {
    const di = allDI.find(d => d.ID === diId); if (!di) return;
    const btAssocie = di.BT_ID ? allBT.find(b => b.BT_ID === di.BT_ID) : null;
    let validateur = '-';
    if (btAssocie) { try { const hist = JSON.parse(btAssocie.Historique || '[]'); const valid = hist.find(h => h.statut === 'Validé'); if (valid) validateur = valid.user; } catch (e) { } }
    const dureeIntervention = btAssocie?.Duree || 0;
    const tempsTotal = btAssocie?.Temps_Total || 0;
    document.getElementById('modalDIContent').innerHTML = `
<div class="di-card ${di.Statut === 'Clôturé' ? 'done' : ''}">
<div class="di-header"><div><div class="di-id">${di.ID}</div></div><span class="di-badge ${di.Statut === 'En attente' ? 'waiting' : 'done'}">${di.Statut}</span></div>
</div>
<div style="margin-top:16px">
<p><strong>📅 Date:</strong> ${di.Date || '-'} ${di.Heure || ''}</p>
<p><strong>📍 Ligne:</strong> ${di.Ligne || '-'}</p>
<p><strong>⚙️ Machine:</strong> ${di.Machine || '-'}</p>
<p><strong>🔧 Zone:</strong> ${di.Zone || '-'}</p>
<p><strong>🔩 Composant:</strong> ${di.Composant || '-'}</p>
<p><strong>⚠️ Anomalie:</strong> ${di.Anomalie || '-'}</p>
${di.Description ? `<p><strong>📝 Description:</strong> ${di.Description}</p>` : ''}
${di.Commentaire ? `<p><strong>💬 Commentaire:</strong> ${di.Commentaire}</p>` : ''}
</div>
<div style="margin-top:12px;padding:12px;background:#fee2e2;border-radius:12px">
<div style="font-weight:700;color:var(--danger);margin-bottom:6px">🚨 Signalé par</div>
<p style="margin:0"><strong>${di.Operateur || '-'}</strong></p>
${di.Techniciens ? `<p style="margin:4px 0 0 0;font-size:13px;color:var(--gray-600)">Techniciens demandés: ${di.Techniciens}</p>` : ''}
</div>
${btAssocie ? `
${(btAssocie.Heure_Arrivee || btAssocie.Heure_Fin || btAssocie.Heure_Validation) ? `<div style="margin-top:12px;padding:12px;background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:12px">
<div style="font-weight:700;color:#92400e;margin-bottom:10px">⏱️ Temps & Horaires</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
<div><strong>🕐 Signalement:</strong> ${di.Heure || '-'}</div>
<div><strong>🔧 Arrivée maint:</strong> ${btAssocie.Heure_Arrivee || '-'}</div>
<div><strong>✅ Fin interv:</strong> ${btAssocie.Heure_Fin || '-'}</div>
<div><strong>✔️ Validation:</strong> ${btAssocie.Heure_Validation || '-'}</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.1)">
<div style="text-align:center;padding:8px;background:rgba(255,255,255,0.5);border-radius:8px">
<div style="font-size:20px;font-weight:800;color:#1e40af">${dureeIntervention} min</div>
<div style="font-size:11px;color:#92400e">Temps intervention</div>
</div>
<div style="text-align:center;padding:8px;background:rgba(255,255,255,0.5);border-radius:8px">
<div style="font-size:20px;font-weight:800;color:#059669">${tempsTotal} min</div>
<div style="font-size:11px;color:#92400e">Temps total</div>
</div>
</div>
</div>`: ''}
<div style="margin-top:12px;padding:12px;background:#dbeafe;border-radius:12px">
<div style="font-weight:700;color:var(--primary);margin-bottom:6px">🔧 Traité par</div>
<p style="margin:0"><strong>${btAssocie.Technicien || '-'}</strong></p>
<p style="margin:4px 0 0 0;font-size:13px;color:var(--gray-600)">Cause: ${btAssocie.Cause || '-'}</p>
<p style="margin:4px 0 0 0;font-size:13px;color:var(--gray-600)">Action: ${btAssocie.Action_Type || '-'}</p>
${btAssocie.Pieces ? `<p style="margin:4px 0 0 0;font-size:13px;color:var(--gray-600)">Pièces: ${btAssocie.Pieces}</p>` : ''}
</div>
${btAssocie.Statut === 'Validé' ? `
<div style="margin-top:12px;padding:12px;background:#d1fae5;border-radius:12px">
<div style="font-weight:700;color:var(--success);margin-bottom:6px">✔️ Validé par</div>
<p style="margin:0"><strong>${validateur}</strong></p>
</div>`: ''}
<p style="margin-top:12px"><strong>📄 BT associé:</strong> <span style="color:var(--warning);font-weight:700">${di.BT_ID}</span></p>
<button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="openBTDetail('${di.BT_ID}');closeModal('modalDI')">📄 Voir le BT complet</button>
` : '<p style="margin-top:12px;color:var(--gray-500);font-style:italic">⏳ En attente de traitement...</p>'}
${(canEditDI(di) || canDeleteDI(di)) ? `<div style="display:flex;gap:10px;margin-top:16px;border-top:1px solid var(--gray-200);padding-top:16px">
${canEditDI(di) ? `<button class="btn btn-warning" style="flex:1" onclick="closeModal('modalDI');openEditDI('${di.ID}')">✏️ Éditer</button>` : ''}
${canDeleteDI(di) ? `<button class="btn" style="flex:1;background:var(--danger);color:#fff" onclick="closeModal('modalDI');confirmDeleteDI('${di.ID}')">🗑️ Supprimer</button>` : ''}
</div>` : ''}
`;
    openModal('modalDI');
}

async function confirmDeleteDI(diId) {
    if (!confirm('Supprimer cette DI?')) return;
    const role = (user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrateur';
    const result = await api('deleteDI', { diId, isAdmin });
    if (result.success) { toast('✅ DI supprimée'); await loadAllData(); } else toast('❌ ' + (result.error || 'Erreur'));
}

async function confirmDeleteBT(btId) { if (!confirm('Supprimer ce BT? La DI associée repassera en "En attente".')) return; const result = await api('deleteBT', { btId }); if (result.success) { toast('✅ BT supprimé'); await loadAllData(); } else toast('❌ ' + (result.error || 'Erreur')); }

function openTraitement(diId) {
    currentDI = allDI.find(di => di.ID === diId); if (!currentDI) return;
    document.getElementById('modalDIInfo').innerHTML = `<div class="di-header"><div><div class="di-id">${currentDI.ID}</div><div class="di-date">${currentDI.Date || ''}</div></div></div><div class="di-machine">⚙️ ${currentDI.Machine}</div><div class="di-info">📍 ${currentDI.Ligne} | 🔧 ${currentDI.Zone} | 🔩 ${currentDI.Composant}</div><div class="di-info">⚠️ ${currentDI.Anomalie}</div>${currentDI.Description ? `<div class="di-info">📝 ${currentDI.Description}</div>` : ''}`;
    document.getElementById('traitCause').value = ''; document.getElementById('traitDiag').value = ''; document.getElementById('traitAction').value = ''; document.getElementById('traitDetail').value = '';
    
    // Reset Modal for DI processing
    document.querySelector('#modalTraitement .modal-header h3').textContent = '🔧 Traiter DI';
    const btn = document.getElementById('btnCloseDI');
    btn.innerHTML = '✅ Clôturer et Générer BT';
    btn.onclick = closeDI;
    
    openModal('modalTraitement');
}

function openFinishBT(btId) {
    currentBT = allBT.find(b => b.BT_ID === btId); if (!currentBT) return;
    const di = allDI.find(d => d.ID === currentBT.Anomalie_ID);
    
    // Reuse modalTraitement layout
    document.getElementById('modalDIInfo').innerHTML = `<div class="bt-header"><div><div class="bt-id">${currentBT.BT_ID}</div><div class="bt-ref">Réf: ${currentBT.Anomalie_ID || '-'}</div></div><span class="bt-statut ${getStatutClass(currentBT.Statut)}">${currentBT.Statut}</span></div><div class="di-machine">⚙️ ${currentBT.Machine || '-'}</div><div class="di-info">⚠️ ${di ? di.Anomalie : '-'}</div>`;
    
    // Clear previous values
    document.getElementById('traitCause').value = '';
    document.getElementById('traitDiag').value = '';
    document.getElementById('traitAction').value = '';
    document.getElementById('traitDetail').value = '';
    document.getElementById('traitPieces').value = ''; 
    
    // Update Modal Title and Button
    document.querySelector('#modalTraitement .modal-header h3').textContent = '✅ Clôture Technique';
    const btn = document.getElementById('btnCloseDI');
    btn.innerHTML = '💾 Enregistrer & Terminer';
    btn.onclick = finishBT; 
    
    openModal('modalTraitement');
}

async function finishBT() {
    if (!currentBT) return;
    const cause = document.getElementById('traitCause').value;
    const diagnostic = document.getElementById('traitDiag').value;
    const actionType = document.getElementById('traitAction').value;
    const actionDetail = document.getElementById('traitDetail').value;
    const pieces = document.getElementById('traitPieces').value;
    
    if (!cause || !diagnostic || !actionType || !actionDetail) { toast('⚠️ Remplir tous les champs obligatoires'); return; }
    
    const btn = document.getElementById('btnCloseDI'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    
    // 1. Update BT Details
    const updateResult = await api('updateBT', {
        btId: currentBT.BT_ID,
        cause, diagnostic, actionType, actionDetail, pieces
    });
    
    if (updateResult.success) {
        // 2. Set Status to Terminé with Heure Fin
        const now = new Date();
        const heureFin = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        
        const statutResult = await api('updateBTStatut', {
            btId: currentBT.BT_ID,
            newStatut: 'Terminé',
            comment: 'Clôture technique par technicien',
            userName: user.nom,
            heureFin: heureFin,
            heureArrivee: currentBT.Heure_Arrivee
        });
        
        if (statutResult.success) {
            toast('✅ Intervention terminée!');
            closeModal('modalTraitement');
            await loadAllData();
        } else {
            toast('❌ Erreur statut: ' + statutResult.error);
        }
    } else {
        toast('❌ Erreur mise à jour: ' + updateResult.error);
    }
    btn.disabled = false; btn.innerHTML = '✅ Clôturer et Générer BT';
}


async function closeDI() {
    if (!currentDI) return;
    const cause = document.getElementById('traitCause').value, diagnostic = document.getElementById('traitDiag').value, actionType = document.getElementById('traitAction').value, actionDetail = document.getElementById('traitDetail').value, pieces = document.getElementById('traitPieces').value;
    if (!cause || !diagnostic || !actionType || !actionDetail) { toast('⚠️ Remplir tous les champs obligatoires'); return; }
    const btn = document.getElementById('btnCloseDI'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    const result = await api('cloturerDI', { diId: currentDI.ID, technicien: user.nom, cause, diagnostic, actionType, actionDetail, pieces: pieces, userId: user.id });
    if (result.success) { toast('✅ BT généré: ' + result.btId); closeModal('modalTraitement'); await loadAllData(); }
    else toast('❌ ' + (result.error || 'Erreur'));
    btn.disabled = false; btn.innerHTML = '✅ Clôturer et Générer BT';
}

function getStatutClass(s) { switch (s) { case 'En cours': return 'en-cours'; case 'En attente pièces': return 'attente'; case 'Terminé': return 'termine'; case 'Validé': return 'valide'; default: return 'en-cours'; } }

function renderBTList(filter = '') {
    let bts = allBT; if (filter) { const f = filter.toLowerCase(); bts = bts.filter(bt => (bt.BT_ID || '').toLowerCase().includes(f) || (bt.Machine || '').toLowerCase().includes(f)); }
    if (!bts.length) { document.getElementById('btList').innerHTML = '<div class="list-empty"><div class="empty-icon">📭</div>Aucun BT</div>'; return; }
    document.getElementById('btList').innerHTML = bts.map(bt => { const statut = bt.Statut || 'En cours'; return `<div class="bt-card" onclick="openBTDetail('${bt.BT_ID}')"><div class="bt-header"><div><div class="bt-id">${bt.BT_ID}</div><div class="bt-ref">Réf: ${bt.Anomalie_ID || '-'}</div></div><span class="bt-statut ${getStatutClass(statut)}">${statut}</span></div><div class="bt-grid"><div class="bt-section"><div class="bt-section-title">Machine</div><div class="bt-section-value">${bt.Machine || '-'}</div></div><div class="bt-section"><div class="bt-section-title">Technicien</div><div class="bt-section-value">${bt.Technicien || '-'}</div></div></div></div>`; }).join('');
}

function renderHistoriqueBT() {
    const search = (document.getElementById('searchHistBT').value || '').toLowerCase();
    let bts = allBT; if (search) bts = bts.filter(b => (b.BT_ID || '').toLowerCase().includes(search) || (b.Machine || '').toLowerCase().includes(search));
    if (!bts.length) { document.getElementById('histBTList').innerHTML = '<div class="list-empty"><div class="empty-icon">📭</div>Aucun BT</div>'; return; }
    document.getElementById('histBTList').innerHTML = bts.map(bt => { const statut = bt.Statut || 'En cours'; return `<div class="bt-card" onclick="openBTDetail('${bt.BT_ID}')"><div class="bt-header"><div><div class="bt-id">${bt.BT_ID}</div><div class="bt-ref">${bt.Date || ''}</div></div><span class="bt-statut ${getStatutClass(statut)}">${statut}</span></div><div class="bt-section"><div class="bt-section-title">Machine</div><div class="bt-section-value">${bt.Machine || '-'}</div></div></div>`; }).join('');
}

function renderBTToValidate() {
    const bts = allBT.filter(b => b.Statut === 'Terminé');
    if (!bts.length) { document.getElementById('btToValidateList').innerHTML = '<div class="list-empty"><div class="empty-icon">✅</div>Aucun BT à valider</div>'; return; }
    document.getElementById('btToValidateList').innerHTML = bts.map(bt => `<div class="bt-card" onclick="openChangeStatut('${bt.BT_ID}')"><div class="bt-header"><div><div class="bt-id">${bt.BT_ID}</div><div class="bt-ref">Réf: ${bt.Anomalie_ID || '-'}</div></div><span class="bt-statut termine">Terminé</span></div><div class="bt-grid"><div class="bt-section"><div class="bt-section-title">Machine</div><div class="bt-section-value">${bt.Machine || '-'}</div></div><div class="bt-section"><div class="bt-section-title">Technicien</div><div class="bt-section-value">${bt.Technicien || '-'}</div></div></div><div class="di-actions"><button class="di-btn success">✔️ Valider</button></div></div>`).join('');
}

function openBTDetail(btId) {
    currentBT = allBT.find(b => b.BT_ID === btId); if (!currentBT) return;
    const statut = currentBT.Statut || 'En cours';
    const diAssociee = allDI.find(d => d.ID === currentBT.Anomalie_ID);
    let historiqueHTML = '';
    try {
        const hist = JSON.parse(currentBT.Historique || '[]');
        if (hist.length) {
            historiqueHTML = '<div style="margin-top:16px;padding:12px;background:var(--gray-50);border-radius:12px"><div style="font-weight:700;margin-bottom:10px">📜 Historique des actions</div>';
            hist.forEach(h => {
                historiqueHTML += `<div style="padding:8px 0;border-bottom:1px solid var(--gray-200);font-size:13px"><span style="color:var(--primary);font-weight:600">${h.statut}</span> par <strong>${h.user || '-'}</strong><br><span style="color:var(--gray-400)">${h.date || ''}</span>${h.comment ? ` - ${h.comment}` : ''}</div>`;
            });
            historiqueHTML += '</div>';
        }
    } catch (e) { }
    const dureeIntervention = currentBT.Duree || 0;
    const tempsTotal = currentBT.Temps_Total || 0;
    const hasTimes = currentBT.Heure_Arrivee || currentBT.Heure_Fin || currentBT.Heure_Validation;
    document.getElementById('modalBTContent').innerHTML = `
<div class="bt-card"><div class="bt-header"><div><div class="bt-id">${currentBT.BT_ID}</div><div class="bt-ref">Réf: ${currentBT.Anomalie_ID || '-'}</div></div><span class="bt-statut ${getStatutClass(statut)}">${statut}</span></div></div>
<div style="margin-top:16px">
<p><strong>📅 Date:</strong> ${currentBT.Date || '-'}</p>
<p><strong>⚙️ Machine:</strong> ${currentBT.Machine || '-'}</p>
<p><strong>📍 Ligne:</strong> ${currentBT.Ligne || '-'}</p>
<p><strong>⚠️ Anomalie:</strong> ${currentBT.Anomalie || '-'}</p>
${currentBT.Pieces ? `<p><strong>🔩 Pièces:</strong> ${currentBT.Pieces}</p>` : ''}
</div>
${hasTimes ? `<div style="margin-top:12px;padding:12px;background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:12px">
<div style="font-weight:700;color:#92400e;margin-bottom:10px">⏱️ Temps & Horaires</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
<div><strong>🕐 Signalement:</strong> ${diAssociee?.Heure || '-'}</div>
<div><strong>🔧 Arrivée maint:</strong> ${currentBT.Heure_Arrivee || '-'}</div>
<div><strong>✅ Fin interv:</strong> ${currentBT.Heure_Fin || '-'}</div>
<div><strong>✔️ Validation:</strong> ${currentBT.Heure_Validation || '-'}</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.1)">
<div style="text-align:center;padding:8px;background:rgba(255,255,255,0.5);border-radius:8px">
<div style="font-size:20px;font-weight:800;color:#1e40af">${dureeIntervention} min</div>
<div style="font-size:11px;color:#92400e">Temps intervention</div>
</div>
<div style="text-align:center;padding:8px;background:rgba(255,255,255,0.5);border-radius:8px">
<div style="font-size:20px;font-weight:800;color:#059669">${tempsTotal} min</div>
<div style="font-size:11px;color:#92400e">Temps total</div>
</div>
</div>
</div>`: ''}
<div style="margin-top:12px;padding:12px;background:#fee2e2;border-radius:12px">
<div style="font-weight:700;color:var(--danger);margin-bottom:6px">🚨 Signalé par</div>
<p style="margin:0"><strong>${diAssociee?.Operateur || '-'}</strong></p>
</div>
<div style="margin-top:12px;padding:12px;background:#dbeafe;border-radius:12px">
<div style="font-weight:700;color:var(--primary);margin-bottom:6px">🔧 Traité par</div>
<p style="margin:0"><strong>${currentBT.Technicien || '-'}</strong></p>
<p style="margin:4px 0 0 0;font-size:13px;color:var(--gray-600)">Cause: ${currentBT.Cause || '-'}</p>
<p style="margin:4px 0 0 0;font-size:13px;color:var(--gray-600)">Diagnostic: ${currentBT.Diagnostic || '-'}</p>
<p style="margin:4px 0 0 0;font-size:13px;color:var(--gray-600)">Action: ${currentBT.Action_Type || '-'} - ${currentBT.Action_Detail || '-'}</p>
</div>
${statut === 'Validé' ? `<div style="margin-top:12px;padding:12px;background:#d1fae5;border-radius:12px">
<div style="font-weight:700;color:var(--success);margin-bottom:6px">✔️ Validé par</div>
<p style="margin:0"><strong>${getValidateur(currentBT.Historique)}</strong></p>
</div>`: ''}
${historiqueHTML}
<div style="display:flex;gap:10px;margin-top:16px">
${(currentBT.Statut === 'En cours' || currentBT.Statut === 'En attente pièces') && (user.role === 'technicien' || user.role === 'chef_equipe' || user.role === 'admin') ? `<button class="btn btn-success" style="flex:1" onclick="openFinishBT('${currentBT.BT_ID}');closeModal('modalBT')">✅ Terminer</button>` : ''}
${canEditBT(currentBT) ? `<button class="btn btn-warning" style="flex:1" onclick="openEditBT('${currentBT.BT_ID}');closeModal('modalBT')">✏️ Éditer</button>` : ''}
<button class="btn btn-primary" style="flex:1" onclick="openChangeStatut('${currentBT.BT_ID}');closeModal('modalBT')">📊 Changer statut</button>
${canDeleteBT(currentBT) ? `<button class="btn" style="flex:1;background:var(--danger);color:#fff" onclick="closeModal('modalBT');confirmDeleteBT('${currentBT.BT_ID}')">🗑️ Supprimer</button>` : ''}
</div>`;
    openModal('modalBT');
}

function getValidateur(histJson) {
    try { const hist = JSON.parse(histJson || '[]'); const valid = hist.find(h => h.statut === 'Validé'); return valid?.user || '-'; } catch (e) { return '-'; }
}


function openChangeStatut(btId) {
    currentBT = allBT.find(b => b.BT_ID === btId); if (!currentBT) return;
    const statut = currentBT.Statut || 'En cours', role = (user.role || '').toLowerCase();
    const canValidate = (role === 'chef_equipe' || role === 'chef equipe');
    document.getElementById('modalStatutBTInfo').innerHTML = `<div class="bt-header"><div><div class="bt-id">${currentBT.BT_ID}</div><div class="bt-ref">Réf: ${currentBT.Anomalie_ID || '-'}</div></div><span class="bt-statut ${getStatutClass(statut)}">${statut}</span></div><div class="bt-section"><div class="bt-section-title">Machine</div><div class="bt-section-value">${currentBT.Machine || '-'}</div></div>`;
    const statuts = [{ value: 'En cours', label: '🔧 En cours' }, { value: 'En attente pièces', label: '📦 En attente pièces' }, { value: 'Terminé', label: '✅ Terminé' }];
    if (canValidate) statuts.push({ value: 'Validé', label: '✔️ Validé (Chef équipe)' });
    const select = document.getElementById('selectNewStatut');
    select.innerHTML = statuts.map(s => `<option value="${s.value}" ${s.value === statut ? 'selected' : ''}>${s.label}</option>`).join('');
    document.getElementById('validationInfo').style.display = canValidate ? 'none' : 'block';
    document.getElementById('statutComment').value = '';
    document.querySelectorAll('#modalStatutBT .statut-step').forEach(step => { step.classList.remove('active', 'completed'); const stepStatut = step.dataset.statut; const order = { 'En cours': 1, 'En attente pièces': 2, 'Terminé': 3, 'Validé': 4 }; if (stepStatut === statut) step.classList.add('active'); else if (order[stepStatut] < order[statut]) step.classList.add('completed'); });
    openModal('modalStatutBT');
}

async function saveNewStatut() {
    if (!currentBT) return;
    const newStatut = document.getElementById('selectNewStatut').value, comment = document.getElementById('statutComment').value.trim(), oldStatut = currentBT.Statut || 'En cours', role = (user.role || '').toLowerCase();
    if (newStatut === oldStatut) { toast('⚠️ Même statut'); return; }
    if (newStatut === 'Validé' && role !== 'chef_equipe' && role !== 'chef equipe') { toast('❌ Seul le Chef d\'équipe peut valider'); return; }
    let heureArrivee = '', heureFin = '';
    if (newStatut === 'Terminé') {
        heureArrivee = document.getElementById('btHeureArrivee').value;
        heureFin = document.getElementById('btHeureFin').value;
        if (!heureArrivee || !heureFin) { toast('⚠️ Remplir les horaires d\'intervention'); return; }
    }
    let heureValidation = '';
    if (newStatut === 'Validé') { heureValidation = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
    const btn = document.getElementById('btnSaveStatut'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    const result = await api('updateBTStatut', { btId: currentBT.BT_ID, newStatut, comment, userName: user.nom, heureArrivee, heureFin, heureValidation });
    if (result.success) { toast('✅ Statut mis à jour'); closeModal('modalStatutBT'); await loadAllData(); if (document.getElementById('pageValidation').classList.contains('active')) renderBTToValidate(); }
    else toast('❌ ' + (result.error || 'Erreur'));
    btn.disabled = false; btn.innerHTML = '💾 Valider';
}

function setCurrentTime(inputId) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById(inputId).value = hh + ':' + mm;
}

function onStatutChange() {
    const newStatut = document.getElementById('selectNewStatut').value;
    const horairesDiv = document.getElementById('horairesIntervention');
    if (newStatut === 'Terminé') { horairesDiv.style.display = 'block'; }
    else { horairesDiv.style.display = 'none'; }
}

let editingDI = null;
function openEditDI(diId) {
    editingDI = allDI.find(d => d.ID === diId);
    if (!editingDI || editingDI.Statut !== 'En attente') { toast('❌ DI non modifiable'); return; }
    const lignes = [...new Set((db.machines || []).map(m => m.Ligne).filter(Boolean))];
    document.getElementById('editDILigne').innerHTML = lignes.map(l => `<option value="${l}" ${l === editingDI.Ligne ? 'selected' : ''}>${l}</option>`).join('');
    populateEditMachines();
    document.getElementById('editDILigne').onchange = populateEditMachines;
    document.getElementById('editDIMachine').onchange = populateEditZones;
    document.getElementById('editDIZone').onchange = populateEditComposants;
    document.getElementById('editDIAnomalie').innerHTML = (db.anomalies || []).map(a => `<option value="${a.Anomalie}" ${a.Anomalie === editingDI.Anomalie ? 'selected' : ''}>${a.Anomalie}</option>`).join('');
    document.getElementById('editDIComment').value = editingDI.Commentaire || '';
    openModal('modalEditDI');
}

function populateEditMachines() {
    const ligne = document.getElementById('editDILigne').value;
    const machines = (db.machines || []).filter(m => m.Ligne === ligne);
    document.getElementById('editDIMachine').innerHTML = machines.map(m => `<option value="${m.Machine}" ${m.Machine === editingDI?.Machine ? 'selected' : ''}>${m.Machine}</option>`).join('');
    populateEditZones();
}

function populateEditZones() {
    const machine = document.getElementById('editDIMachine').value;
    const zones = (db.zones || []).filter(z => z.Machine === machine);
    document.getElementById('editDIZone').innerHTML = zones.map(z => `<option value="${z.Zone}" ${z.Zone === editingDI?.Zone ? 'selected' : ''}>${z.Zone}</option>`).join('');
    populateEditComposants();
}

function populateEditComposants() {
    const zone = document.getElementById('editDIZone').value;
    const composants = (db.composants || []).filter(c => c.Zone === zone);
    document.getElementById('editDIComposant').innerHTML = composants.map(c => `<option value="${c.Composant}" ${c.Composant === editingDI?.Composant ? 'selected' : ''}>${c.Composant}</option>`).join('');
}

async function saveEditDI() {
    if (!editingDI) return;
    const data = { diId: editingDI.ID, ligne: document.getElementById('editDILigne').value, machine: document.getElementById('editDIMachine').value, zone: document.getElementById('editDIZone').value, composant: document.getElementById('editDIComposant').value, anomalie: document.getElementById('editDIAnomalie').value, commentaire: document.getElementById('editDIComment').value };
    const result = await api('updateDI', data);
    if (result.success) { toast('✅ DI modifiée'); closeModal('modalEditDI'); await loadAllData(); }
    else toast('❌ ' + (result.error || 'Erreur'));
}

let editingBT = null;
function openEditBT(btId) {
    editingBT = allBT.find(b => b.BT_ID === btId);
    if (!editingBT) { toast('❌ BT non trouvé'); return; }
    if (!canEditBT(editingBT)) { toast('❌ Vous n\'avez pas la permission de modifier ce BT'); return; }
    document.getElementById('editBTInfo').innerHTML = `<div class="bt-header"><div><div class="bt-id">${editingBT.BT_ID}</div><div class="bt-ref">Réf: ${editingBT.Anomalie_ID || '-'}</div></div><span class="bt-statut ${getStatutClass(editingBT.Statut)}">${editingBT.Statut}</span></div>`;
    document.getElementById('editBTCause').value = editingBT.Cause || '';
    document.getElementById('editBTDiag').value = editingBT.Diagnostic || '';
    document.getElementById('editBTAction').value = editingBT.Action_Type || '';
    document.getElementById('editBTDetail').value = editingBT.Action_Detail || '';
    document.getElementById('editBTPieces').value = editingBT.Pieces || '';
    openModal('modalEditBT');
}

async function saveEditBT() {
    if (!editingBT) return;
    const data = {
        btId: editingBT.BT_ID,
        cause: document.getElementById('editBTCause').value,
        diagnostic: document.getElementById('editBTDiag').value,
        actionType: document.getElementById('editBTAction').value,
        actionDetail: document.getElementById('editBTDetail').value,
        pieces: document.getElementById('editBTPieces').value
    };
    const result = await api('updateBT', data);
    if (result.success) { toast('✅ BT modifié'); closeModal('modalEditBT'); await loadAllData(); }
    else toast('❌ ' + (result.error || 'Erreur'));
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

function toggleNotifications() {
    const panel = document.getElementById('notifPanel');
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) {
        renderNotifications();
        document.addEventListener('click', closeNotifOnClickOutside);
    } else {
        document.removeEventListener('click', closeNotifOnClickOutside);
    }
}

function closeNotifOnClickOutside(e) {
    const panel = document.getElementById('notifPanel');
    const btn = document.getElementById('btnNotif');
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('show');
        document.removeEventListener('click', closeNotifOnClickOutside);
    }
}

function addNotification(type, title, desc, refId) {
    const notif = {
        id: Date.now(),
        type: type,
        title: title,
        desc: desc,
        refId: refId,
        time: new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        unread: true
    };
    notifications.unshift(notif);
    if (notifications.length > 50) notifications = notifications.slice(0, 50);
    saveNotifications();
    updateNotifBadge();
    toast(`🔔 ${title}`);
    sendPushNotification(title, desc, type, refId);
}

function renderNotifications() {
    const list = document.getElementById('notifList');
    if (!notifications.length) {
        list.innerHTML = '<div class="list-empty" style="padding:30px"><div class="empty-icon" style="font-size:40px">🔕</div>Aucune notification</div>';
        return;
    }
    list.innerHTML = notifications.map(n => `
<div class="notif-item ${n.unread ? 'unread' : ''} ${n.type}" onclick="openNotification('${n.id}','${n.type}','${n.refId}')">
<div style="display:flex;align-items:flex-start">
<span class="notif-icon">${n.type === 'di' ? '🚨' : n.type === 'bt' ? '📄' : '📊'}</span>
<div class="notif-content">
<div class="notif-title">${n.title}</div>
<div class="notif-desc">${n.desc}</div>
<div class="notif-time">${n.time}</div>
</div>
</div>
</div>
`).join('');
}

function openNotification(notifId, type, refId) {
    const notif = notifications.find(n => n.id == notifId);
    if (notif) notif.unread = false;
    saveNotifications();
    updateNotifBadge();
    document.getElementById('notifPanel').classList.remove('show');
    if (type === 'di' && refId) openDIDetail(refId);
    else if ((type === 'bt' || type === 'statut') && refId) openBTDetail(refId);
}

function clearNotifications() {
    notifications = [];
    saveNotifications();
    updateNotifBadge();
    renderNotifications();
}

function saveNotifications() {
    localStorage.setItem('gmao_notifications', JSON.stringify(notifications));
}

function updateNotifBadge() {
    const unreadCount = notifications.filter(n => n.unread).length;
    const badge = document.getElementById('notifBadge');
    badge.textContent = unreadCount;
    if (unreadCount > 0) badge.classList.add('show');
    else badge.classList.remove('show');
}

function checkForNewItems() {
    const newDIs = allDI.filter(di => {
        const diDate = parseDate(di.Date);
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        return diDate > fiveMinAgo && !notifications.some(n => n.refId === di.ID && n.type === 'di');
    });
    newDIs.forEach(di => {
        if (di.Operateur !== user.nom) {
            addNotification('di', `Nouvelle DI: ${di.ID}`, `${di.Machine} - ${di.Anomalie} par ${di.Operateur}`, di.ID);
        }
    });

    const newBTs = allBT.filter(bt => {
        const btDate = parseDate(bt.Date);
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        return btDate > fiveMinAgo && !notifications.some(n => n.refId === bt.BT_ID && n.type === 'bt');
    });
    newBTs.forEach(bt => {
        if (bt.Technicien !== user.nom) {
            addNotification('bt', `Nouveau BT: ${bt.BT_ID}`, `${bt.Machine} - Traité par ${bt.Technicien}`, bt.BT_ID);
        }
    });

    allBT.forEach(bt => {
        try {
            const hist = JSON.parse(bt.Historique || '[]');
            hist.forEach(h => {
                const notifKey = `${bt.BT_ID}-${h.statut}-${h.date}`;
                if (!notifications.some(n => n.id === notifKey) && h.user !== user.nom) {
                    const hDate = new Date(h.date.split(' ')[0].split('/').reverse().join('-') + ' ' + h.date.split(' ')[1]);
                    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
                    if (hDate > fiveMinAgo) {
                        addNotification('statut', `${bt.BT_ID} → ${h.statut}`, `Par ${h.user}`, bt.BT_ID);
                    }
                }
            });
        } catch (e) { }
    });

    updateNotifBadge();
}

async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.log('Push notifications non supportées');
        const banner = document.getElementById('pushNotifBanner');
        if (banner) banner.style.display = 'none';
        return;
    }

    try {
        swRegistration = await navigator.serviceWorker.ready;
        console.log('Service Worker prêt pour notifications');
        updatePushBannerStatus();
    } catch (e) {
        console.error('Erreur SW:', e);
    }
}

function updatePushBannerStatus() {
    const banner = document.getElementById('pushNotifBanner');
    const btn = document.getElementById('btnEnablePush');
    if (!banner || !btn) return;

    if (Notification.permission === 'granted') {
        banner.style.background = 'linear-gradient(135deg, #d1fae5, #a7f3d0)';
        btn.textContent = '✅ Activées';
        btn.disabled = true;
        btn.style.background = 'var(--success)';
    } else if (Notification.permission === 'denied') {
        banner.style.background = 'linear-gradient(135deg, #fee2e2, #fecaca)';
        btn.textContent = '❌ Bloquées';
        btn.disabled = true;
        btn.style.background = 'var(--gray-400)';
    }
}

async function requestPushPermission() {
    const btn = document.getElementById('btnEnablePush');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            toast('✅ Notifications activées!');
            sendPushNotification('🔔 GMAO BAHIA', 'Notifications activées! Vous recevrez les alertes.', 'test', null);
        } else if (permission === 'denied') {
            toast('❌ Notifications refusées');
        }

        updatePushBannerStatus();
    } catch (e) {
        console.error('Erreur permission:', e);
        toast('❌ Erreur');
        btn.disabled = false;
        btn.textContent = 'Activer';
    }
}

function sendPushNotification(title, body, type, refId) {
    if (Notification.permission !== 'granted') return;

    if (swRegistration && swRegistration.active) {
        swRegistration.active.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: title,
            body: body,
            tag: 'gmao-' + type + '-' + (refId || Date.now()),
            notifType: type,
            refId: refId
        });
    } else {
        try {
            new Notification(title, {
                body: body,
                icon: './icon-192.png',
                tag: 'gmao-' + Date.now()
            });
        } catch (e) { console.log('Notification fallback error:', e); }
    }
}
