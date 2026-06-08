// ══ CONFIG ══════════════════════════════════════════════════
// User's provided Backend URL
const API_URL = "https://script.google.com/macros/s/AKfycbzKMk776Qk-GOVG9d0jj0XhD52lwTXk5qy4SEtkgB6wZzESPCSLZ8KpdwnTBWI9Le8xCg/exec";

// ══ STATE ═══════════════════════════════════════════════════
let db = { USERS: [], TRANSACTIONS: [], DUES: [], "ITEM DETAILS": [], "ITEM MASTER": [], "VILLAGE MASTER": [] };
let loggedInUid = null;
let bootstrapTranModal, bootstrapDuesDetailModal, bootstrapItemModal;

// ══ INIT ════════════════════════════════════════════════════
window.onload = () => {
    bootstrapTranModal = new bootstrap.Modal(document.getElementById('tranModal'));
    bootstrapDuesDetailModal = new bootstrap.Modal(document.getElementById('duesDetailModal'));
    bootstrapItemModal = new bootstrap.Modal(document.getElementById('itemModal'));

    const saved = sessionStorage.getItem('ledgerData');
    const savedUid = sessionStorage.getItem('ledgerUid');
    if (saved && savedUid) {
        db = JSON.parse(saved);
        loggedInUid = savedUid;
        showMainApp();
    }
};

// ══ LOGIN ═══════════════════════════════════════════════════
async function handleLoginSubmit() {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value;
    if (!email || !password) { alert("Please enter email and password."); return; }

    showLoader("Securing connection...");
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', email, password }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow'
        });
        const result = await response.json();

        if (result.status === "success") {
            db = result.data;
            loggedInUid = result.user_uid;
            sessionStorage.setItem('ledgerData', JSON.stringify(db));
            sessionStorage.setItem('ledgerUid', loggedInUid);
            showMainApp();
        } else {
            alert(result.message || "Login Failed! Check your credentials.");
        }
    } catch (err) {
        alert("Network error. Please check your connection and try again.");
    } finally {
        hideLoader();
    }
}

// ══ SHOW / HIDE ══════════════════════════════════════════════
function showLoader(msg) {
    document.getElementById('loader-text').innerText = msg || 'Loading...';
    document.getElementById('loader').style.display = 'flex';
}
function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

function showMainApp() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    setupUserProfile();
    initializeViews();
}

function logout() {
    sessionStorage.removeItem('ledgerData');
    sessionStorage.removeItem('ledgerUid');
    db = { USERS: [], TRANSACTIONS: [], DUES: [], "ITEM DETAILS": [], "ITEM MASTER": [], "VILLAGE MASTER": [] };
    loggedInUid = null;

    const sidebarEl = document.getElementById('userSidebar');
    const offcanvas = bootstrap.Offcanvas.getInstance(sidebarEl);
    if (offcanvas) offcanvas.hide();

    document.getElementById('main-app').style.display = 'none';
    document.getElementById('login-view').style.display = 'flex';
    document.getElementById('login-email').value = '';
    document.getElementById('login-pass').value = '';
}

// ══ HELPERS ══════════════════════════════════════════════════
function safeNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    const cleaned = String(val).replace(/[₹,\s]/g, '');
    return parseFloat(cleaned) || 0;
}

function formatCurr(amount) {
    const n = safeNum(amount);
    return "₹" + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDate(str) {
    if (!str) return null;
    str = String(str).trim();
    if (/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(str)) return new Date(str.replace(/\//g, '-'));
    const dmy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`);
    const d = new Date(str);
    return isNaN(d) ? null : d;
}

function getActualTxnDues(tid) {
    const t = db.TRANSACTIONS.find(x => x.TID === tid);
    if (!t) return 0;
    let duesPaidLater = 0;
    db.DUES.filter(d => d.TID === tid).forEach(d => {
        duesPaidLater += safeNum(d['TOTAL DUES PAID']);
    });
    return Math.max(0, safeNum(t.DUES) - duesPaidLater);
}

function getLoggedInUserInfo() {
    const user = db.USERS[0] || {};
    const village = (db['VILLAGE MASTER'] || []).find(v => v.VID === user.VID) || {};
    return {
        name:    user.NAME    || 'User',
        mobile:  user.MOBILE  || 'N/A',
        email:   user.EMAIL   || 'N/A',
        role:    user.ROLE    || 'User',
        village: village.NAME || 'N/A',
        initial: (user.NAME || 'U').charAt(0).toUpperCase()
    };
}

function getItemName(iid) {
    return ((db['ITEM MASTER'] || []).find(m => m.IID === iid) || {})['ITEM NAME'] || 'Unknown Item';
}

function getItemType(iid) {
    return ((db['ITEM MASTER'] || []).find(m => m.IID === iid) || {})['ITEM TYPE'] || '';
}

function escHtml(str) {
    return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ══ SETUP PROFILE ════════════════════════════════════════════
function setupUserProfile() {
    const ui = getLoggedInUserInfo();
    document.getElementById('dash-username').innerText = 'Hi, ' + ui.name.split(' ')[0];
    document.getElementById('side-avatar').innerText = ui.initial;
    document.getElementById('side-name').innerText   = ui.name;
    document.getElementById('side-role').innerHTML   = `<i class="fas fa-shield-alt me-1"></i>${ui.role}`;
    document.getElementById('side-mobile').innerText = ui.mobile;
    document.getElementById('side-email').innerText  = ui.email;
    document.getElementById('side-village').innerText = ui.village;
}

// ══ INIT VIEWS ═══════════════════════════════════════════════
function initializeViews() {
    renderDashboard();
    renderTransactions();
    renderDues();
    renderItems();
}

function switchTab(tabId, btnEl) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToItems() {
    const sidebarEl = document.getElementById('userSidebar');
    const offcanvas = bootstrap.Offcanvas.getInstance(sidebarEl);
    if (offcanvas) offcanvas.hide();
    switchTab('items', null); 
}

// ══ REVERSED LOGIC FOR USER VIEW ════════════════════════════

function renderDashboard() {
    let userTotCredit = 0, userTotDebit = 0, userCrDues = 0, userDrDues = 0;
    db.TRANSACTIONS.forEach(t => {
        const finalAmt = safeNum(t.SUBTOTAL) - safeNum(t.DISCOUNT);
        const actualDue = getActualTxnDues(t.TID);
        
        const isBusinessCr = (t.TYPE || '').trim().toLowerCase() === 'credit';
        const isUserCr = !isBusinessCr; 

        if (isUserCr) { 
            userTotCredit += finalAmt; 
            userCrDues += actualDue; 
        } else { 
            userTotDebit += finalAmt; 
            userDrDues += actualDue; 
        }
    });
    document.getElementById('dash-tot-credit').innerText  = formatCurr(userTotCredit);
    document.getElementById('dash-tot-debit').innerText   = formatCurr(userTotDebit);
    document.getElementById('dash-dues-credit').innerText = formatCurr(userCrDues);
    document.getElementById('dash-dues-debit').innerText  = formatCurr(userDrDues);
    
    const recentTxns = [...db.TRANSACTIONS].reverse().slice(0, 15);
    const html = recentTxns.map(t => {
        const isUserCr = !((t.TYPE || '').trim().toLowerCase() === 'credit'); 
        const finalAmt = safeNum(t.SUBTOTAL) - safeNum(t.DISCOUNT);
        const actDues  = getActualTxnDues(t.TID);
        
        return `<tr onclick="openTranModal('${escHtml(t.TID)}')">
            <td><div style="font-weight:700;">${t.DATE || '—'}</div></td>
            <td><span class="badge-type ${isUserCr ? 'cr' : 'dr'}">${isUserCr ? 'CR' : 'DR'}</span></td>
            <td class="text-end ${isUserCr ? 'amt-cr' : 'amt-dr'}">${formatCurr(finalAmt)}</td>
            <td class="text-end ${actDues > 0 ? (isUserCr ? 'amt-cr' : 'amt-dr') : 'amt-cr'}">${formatCurr(actDues)}</td>
        </tr>`;
    }).join('');
    
    document.getElementById('dash-recent-tbody').innerHTML = html || '<tr class="empty-row"><td colspan="4">No recent history</td></tr>';
}

// ══ RENDER TRANSACTIONS ═══════════════════════════════════════
function renderTransactions() {
    const fromDate = document.getElementById('tran-from').value ? parseDate(document.getElementById('tran-from').value) : null;
    const toDate   = document.getElementById('tran-to').value   ? parseDate(document.getElementById('tran-to').value)   : null;
    if (toDate) toDate.setHours(23,59,59,999);
    
    const html = [...db.TRANSACTIONS].reverse().filter(t => {
        const d = parseDate(t.DATE);
        if (!d) return true;
        if (fromDate && d < fromDate) return false;
        if (toDate   && d > toDate)   return false;
        return true;
    }).map(t => {
        const isUserCr = !((t.TYPE || '').trim().toLowerCase() === 'credit'); 
        const finalAmt = safeNum(t.SUBTOTAL) - safeNum(t.DISCOUNT);
        const actDues  = getActualTxnDues(t.TID);
   
        return `<tr onclick="openTranModal('${escHtml(t.TID)}')">
            <td style="font-weight:700;">${t.DATE || '—'}</td>
            <td><span class="badge-type ${isUserCr ? 'cr' : 'dr'}">${isUserCr ? 'CR' : 'DR'}</span></td>
            <td class="text-end ${isUserCr ? 'amt-cr' : 'amt-dr'}">${formatCurr(finalAmt)}</td>
            <td class="text-end ${actDues > 0 ? (isUserCr ? 'amt-cr' : 'amt-dr') : 'amt-cr'}">${formatCurr(actDues)}</td>
        </tr>`;
    }).join('');

    document.getElementById('tran-tbody').innerHTML = html || '<tr class="empty-row"><td colspan="4">No transactions found</td></tr>';
}

function clearTranFilters() {
    document.getElementById('tran-from').value = '';
    document.getElementById('tran-to').value   = '';
    renderTransactions();
}

// ══ RENDER DUES ═══════════════════════════════════════════════
function renderDues() {
    const fromDate = document.getElementById('dues-from').value ? parseDate(document.getElementById('dues-from').value) : null;
    const toDate   = document.getElementById('dues-to').value   ? parseDate(document.getElementById('dues-to').value)   : null;
    if (toDate) toDate.setHours(23,59,59,999);
    
    const agg = {};
    db.DUES.forEach(d => {
        const tid = d.TID;
        if (!agg[tid]) {
            const txn = db.TRANSACTIONS.find(t => t.TID === tid) || {};
            agg[tid] = {
                TID: tid,
                txnDate: d['DATE of TRANSACTION'] || txn.DATE || '',
                txnType: (txn.TYPE || '').trim().toLowerCase(),
                originalDues: safeNum(txn.DUES) || safeNum(d['TOTAL DUES AMOUNT']),
                totalPaid: safeNum(d['TOTAL DUES PAID'])
            };
        } else {
            agg[tid].totalPaid += safeNum(d['TOTAL DUES PAID']);
        }
    });
    
    const html = Object.values(agg).reverse().filter(d => {
        const dt = parseDate(d.txnDate);
        if (!dt) return true;
        if (fromDate && dt < fromDate) return false;
        if (toDate   && dt > toDate)   return false;
        return true;
    }).map(d => {
        const isUserCr = !(d.txnType === 'credit'); 
        const bal  = Math.max(0, d.originalDues - d.totalPaid);
        
        return `<tr onclick="openDuesDetailModal('${escHtml(d.TID)}')">
            <td style="font-weight:700;">${d.txnDate || '—'}</td>
            <td><span class="badge-type ${isUserCr ? 'cr' : 'dr'}">${isUserCr ? 'CR' : 'DR'}</span></td>
            <td class="text-end" style="color:var(--text2);">${formatCurr(d.originalDues)}</td>
            <td class="text-end ${isUserCr ? 'amt-dr' : 'amt-cr'}">${formatCurr(d.totalPaid)}</td>
            <td class="text-end ${bal > 0 ? (isUserCr ? 'amt-cr' : 'amt-dr') : 'amt-cr'}">${formatCurr(bal)}</td>
        </tr>`;
    }).join('');

    document.getElementById('dues-tbody').innerHTML = html || '<tr class="empty-row"><td colspan="5">No dues records found</td></tr>';
}

function clearDuesFilters() {
    document.getElementById('dues-from').value = '';
    document.getElementById('dues-to').value   = '';
    renderDues();
}

// ══ RENDER ITEMS (Redesigned Custom Card) ═════════════════════
function renderItems() {
    const query = (document.getElementById('item-search-input').value || '').trim().toLowerCase();
    let items = db['ITEM DETAILS'] || [];

    if (query) {
        items = items.filter(i => {
            const itemName = getItemName(i.IID).toLowerCase();
            return itemName.includes(query); // TID removed from search query check
        });
    }

    if (items.length === 0) {
        document.getElementById('items-list').innerHTML =
            `<div style="text-align:center;padding:40px;color:var(--text3);">
                <i class="fas fa-box-open" style="font-size:2.5rem;margin-bottom:16px;display:block;opacity:0.5;"></i>
                <div style="font-weight:600;font-size:0.95rem;">No items found</div>
            </div>`;
        return;
    }

    const html = [...items].reverse().map(i => {
        const itemName = getItemName(i.IID);
        const txn      = db.TRANSACTIONS.find(t => t.TID === i.TID) || {};
        const txnDate  = txn.DATE || i.DATE || '';

        return `
        <div class="item-card-new" onclick="openItemModal('${escHtml(i.IDID || i.IID + i.TID)}')">
            <div class="item-card-top-row">
                <div class="item-card-name">${itemName}</div>
                <div class="item-card-qty">Qty: ${i.QUANTITY || '—'}</div>
                <div class="item-card-total">${formatCurr(i['ITEM TOTAL'])}</div>
            </div>
            <div class="item-card-bottom-row">
                <div class="item-card-rate">Rate: ${formatCurr(i.RATE)}</div>
                <div style="font-size:0.75rem;">${txnDate}</div>
            </div>
        </div>`;
    }).join('');
    
    document.getElementById('items-list').innerHTML = html;
}

// ══ MODAL: Transaction Detail (With Custom Item Cards) ═══════
function openTranModal(tid) {
    const t = db.TRANSACTIONS.find(x => x.TID === tid);
    if (!t) return;

    const isUserCr = !((t.TYPE || '').trim().toLowerCase() === 'credit');
    
    // Generating the Item Cards instead of the previous responsive table
    const itemRows = (db['ITEM DETAILS'] || []).filter(i => i.TID === tid).map(i => {
        return `
        <div class="item-card-new" style="margin-bottom:8px; cursor:pointer;" onclick="openItemModal('${escHtml(i.IDID || i.IID + i.TID)}')">
            <div class="item-card-top-row">
                <div class="item-card-name">${getItemName(i.IID)}</div>
                <div class="item-card-qty">Qty: ${i.QUANTITY || '—'}</div>
                <div class="item-card-total" style="color:var(--primary);">${formatCurr(i['ITEM TOTAL'])}</div>
            </div>
            <div class="item-card-bottom-row">
                <div class="item-card-rate">Rate: ${formatCurr(i.RATE)}</div>
            </div>
        </div>`;
    }).join('');
    
    let cumPaid = 0;
    const duesRows = (db.DUES || []).filter(d => d.TID === tid).map(d => {
        cumPaid += safeNum(d['TOTAL DUES PAID']);
        return `<tr>
            <td>${d['DUES Payment DATE'] || d['DATE of TRANSACTION'] || '—'}</td>
            <td class="text-end ${isUserCr ? 'amt-dr' : 'amt-cr'}">${formatCurr(d['TOTAL DUES PAID'])}</td>
        </tr>`;
    }).join('');
    
    const originalDues = safeNum(t.DUES);
    const currentDues  = Math.max(0, originalDues - cumPaid);
    const finalAmt     = safeNum(t.SUBTOTAL) - safeNum(t.DISCOUNT);
    
    document.getElementById('modal-tran-content').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
                <div style="font-size:0.75rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;font-weight:700;">Transaction Date</div>
                <div style="font-weight:800;font-size:1.1rem;color:var(--primary);">${t.DATE || '—'}</div>
            </div>
            <span class="badge-type ${isUserCr ? 'cr' : 'dr'}" style="font-size:0.85rem;padding:6px 16px;">${isUserCr ? 'CREDIT' : 'DEBIT'}</span>
        </div>

        <div class="section-chip"><i class="fas fa-boxes"></i>Purchased Items</div>
        
        <div style="margin-bottom:4px;">
            ${itemRows || '<div style="text-align:center;color:var(--text3);padding:20px;">No items listed</div>'}
        </div>

        <div class="section-chip" style="margin-top:20px;"><i class="fas fa-calculator"></i>Summary</div>
        <div class="summary-box">
            <div class="summary-row"><span style="color:var(--text2);">Subtotal</span> <strong>${formatCurr(t.SUBTOTAL)}</strong></div>
            <div class="summary-row"><span style="color:var(--text2);">Discount</span> <strong style="color:var(--success);">−${formatCurr(t.DISCOUNT)}</strong></div>
            <div class="summary-row total"><span>Final Amount</span> <span>${formatCurr(finalAmt)}</span></div>
        </div>

        <div class="section-chip"><i class="fas fa-money-bill-wave"></i>Payment & Dues Track</div>
        
        <div class="table-responsive-wrapper">
            <table class="invoice-table">
                <thead><tr><th>Date</th><th class="text-end">Amount Cleared</th></tr></thead>
                <tbody>
                    <tr>
                        <td>At Transaction Time</td>
                        <td class="text-end ${isUserCr ? 'amt-dr' : 'amt-cr'}">${formatCurr(t.PAID)}</td>
                    </tr>
                    ${duesRows}
                </tbody>
                <tfoot>
                    <tr>
                        <th>Balance Left</th>
                        <th class="text-end ${currentDues > 0 ? (isUserCr ? 'amt-cr' : 'amt-dr') : 'amt-cr'}" style="font-size:1rem;">${formatCurr(currentDues)}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    bootstrapTranModal.show();
}

// ══ MODAL: Dues Detail ════════════════════════════════════════
function openDuesDetailModal(tid) {
    const t = db.TRANSACTIONS.find(x => x.TID === tid);
    if (!t) return;

    const isUserCr = !((t.TYPE || '').trim().toLowerCase() === 'credit');
    const duesRows = (db.DUES || []).filter(d => d.TID === tid);
    let cumPaid = 0;

    const rowsHtml = duesRows.length === 0
        ? '<tr class="empty-row"><td colspan="3">No dues payment records</td></tr>'
        : duesRows.map(d => {
            cumPaid += safeNum(d['TOTAL DUES PAID']);
            const bal = Math.max(0, safeNum(t.DUES) - cumPaid);
            return `<tr>
                <td>${d['DUES Payment DATE'] || '—'}</td>
                <td class="text-end ${isUserCr ? 'amt-dr' : 'amt-cr'}">${formatCurr(d['TOTAL DUES PAID'])}</td>
                <td class="text-end ${bal > 0 ? (isUserCr ? 'amt-cr' : 'amt-dr') : 'amt-cr'}">${formatCurr(bal)}</td>
            </tr>`;
        }).join('');

    const currentDues = Math.max(0, safeNum(t.DUES) - cumPaid);

    document.getElementById('modal-dues-content').innerHTML = `
        <div class="summary-box">
            <div class="summary-row"><span style="color:var(--text2);">Original Dues</span> <strong>${formatCurr(t.DUES)}</strong></div>
            <div class="summary-row"><span style="color:var(--text2);">Total Cleared Later</span> <strong class="${isUserCr ? 'amt-dr' : 'amt-cr'}">${formatCurr(cumPaid)}</strong></div>
            <div class="summary-row total"><span>Balance Left</span> <span class="${currentDues > 0 ? (isUserCr ? 'amt-cr' : 'amt-dr') : 'amt-cr'}">${formatCurr(currentDues)}</span></div>
        </div>

        <div class="section-chip"><i class="fas fa-history"></i>Payment Timeline</div>
        
        <div class="table-responsive-wrapper">
            <table class="invoice-table">
                <thead><tr><th>Date</th><th class="text-end">Amount Cleared</th><th class="text-end">Bal Left</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;
    bootstrapDuesDetailModal.show();
}

// ══ MODAL: Item Detail ════════════════════════════════════════
function openItemModal(idid) {
    const item = (db['ITEM DETAILS'] || []).find(i => (i.IDID || (i.IID + i.TID)) === idid);
    if (!item) return;

    const itemName = getItemName(item.IID);
    const itemType = getItemType(item.IID);
    const txn      = db.TRANSACTIONS.find(t => t.TID === item.TID) || {};
    const isUserCr = !((txn.TYPE || '').trim().toLowerCase() === 'credit'); 

    document.getElementById('modal-item-content').innerHTML = `
        <div style="text-align:center;padding:12px 0 20px;">
            <div style="width:64px;height:64px;background:var(--surface2);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;box-shadow:var(--shadow-sm);">
                <i class="fas fa-box-open" style="color:var(--accent);font-size:1.8rem;"></i>
            </div>
            <div style="font-weight:800;font-size:1.2rem;color:var(--primary);">${itemName}</div>
            ${itemType ? `<div style="font-size:0.85rem;font-weight:600;color:var(--text3);margin-top:4px;">${itemType}</div>` : ''}
        </div>

        <div class="summary-box">
            <div class="summary-row"><span style="color:var(--text2);">Type</span> <span class="badge-type ${isUserCr ? 'cr' : 'dr'}">${isUserCr ? 'CREDIT' : 'DEBIT'}</span></div>
            <div class="summary-row"><span style="color:var(--text2);">Date</span> <strong>${item.DATE || txn.DATE || '—'}</strong></div>
            <div class="summary-row"><span style="color:var(--text2);">Rate</span> <strong>${formatCurr(item.RATE)}</strong></div>
            <div class="summary-row"><span style="color:var(--text2);">Quantity</span> <strong>${item.QUANTITY || '—'}</strong></div>
            <div class="summary-row total"><span>Item Total</span> <span>${formatCurr(item['ITEM TOTAL'])}</span></div>
        </div>

        <button onclick="openTranModal('${escHtml(item.TID)}');bootstrapItemModal.hide();" style="width:100%;background:white;border:1.5px solid var(--accent);color:var(--accent);border-radius:var(--radius-sm);padding:12px;font-weight:700;font-size:0.95rem;cursor:pointer;margin-top:8px;transition:all 0.2s;">
            <i class="fas fa-receipt me-2"></i>View Full Transaction
        </button>
    `;
    bootstrapItemModal.show();
}
