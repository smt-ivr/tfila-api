let currentWhitelist = [];

async function loadPhoneSettings() {
    const didEl = document.getElementById('phone-did');
    const extEl = document.getElementById('phone-ext');
    const statusDiv = document.getElementById('api-status-result');
    
    didEl.innerHTML = '<i class="fas fa-spinner fa-spin text-indigo-300"></i>';
    extEl.innerText = 'טוען נתונים...';
    statusDiv.innerHTML = ''; // איפוס סטטוס בדיקה
    
    try {
        const pass = localStorage.getItem('admin_pass');
        const res = await fetch(`${API_BASE}/phone-settings/routing-info`, {
            headers: { 'Content-Type': 'application/json', 'X-Admin-Pass': pass }
        });
        
        if (res.status === 401) {
            logout();
            return;
        }
        
        const data = await res.json();
        if (data.success) {
            didEl.innerText = data.data.did || 'לא נמצא מספר';
            extEl.innerText = data.data.extension ? `שלוחה: /${data.data.extension}` : 'לא נמצא ניתוב מוגדר';
        } else {
            throw new Error('שגיאה בטעינת נתוני הניתוב');
        }
        
        // טעינת הרשימה הלבנה מיד לאחר מכן
        loadWhitelist();
    } catch (error) {
        didEl.innerText = 'שגיאה';
        extEl.innerText = 'לא ניתן לטעון נתונים';
    }
}

async function checkApiStatus() {
    const btn = document.getElementById('check-api-btn');
    const statusDiv = document.getElementById('api-status-result');
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> בודק...';
    btn.disabled = true;
    statusDiv.innerHTML = '';
    
    try {
        const pass = localStorage.getItem('admin_pass');
        const res = await fetch(`${API_BASE}/phone-settings/ext-settings`, {
            headers: { 'Content-Type': 'application/json', 'X-Admin-Pass': pass }
        });
        
        const data = await res.json();
        
        if (data.success && data.data.extSettings) {
            const ini = data.data.extSettings;
            // בדיקה האם מוגדר API בשלוחה
            if (ini.includes('type=api') && (ini.includes('api_link=') || ini.includes('api_link ='))) {
                statusDiv.innerHTML = `
                    <div class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                        <i class="fas fa-check-circle text-lg"></i>
                        <span>השלוחה מוגדרת כראוי ומחוברת בהצלחה ל-API.</span>
                    </div>`;
            } else {
                statusDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                        <i class="fas fa-times-circle text-lg"></i>
                        <span>כנראה שיש תקלה בהגדרות השלוחה (לא מוגדרת כ-API), נא לפנות למתכנת.</span>
                    </div>`;
            }
        } else {
            throw new Error('לא ניתן לקרוא את הגדרות השלוחה');
        }
    } catch (error) {
        statusDiv.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                <i class="fas fa-exclamation-triangle text-lg"></i>
                <span>שגיאה בתקשורת עם השרת, נא לפנות למתכנת.</span>
            </div>`;
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function loadWhitelist() {
    const tbody = document.getElementById('whitelist-table-body');
    tbody.innerHTML = `<tr><td colspan="2" class="py-8 text-center text-indigo-600"><i class="fas fa-circle-notch fa-spin text-3xl"></i></td></tr>`;
    
    try {
        const pass = localStorage.getItem('admin_pass');
        const res = await fetch(`${API_BASE}/phone-settings/whitelist`, {
            headers: { 'Content-Type': 'application/json', 'X-Admin-Pass': pass }
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת הרשימה הלבנה');
        
        currentWhitelist = data.data || [];
        document.getElementById('total-whitelist-count').innerText = currentWhitelist.length;
        
        renderWhitelist();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="2" class="py-6 text-center text-red-600 font-bold bg-red-50">שגיאה בטעינת הרשימה: ${error.message}</td></tr>`;
    }
}

function renderWhitelist() {
    const tbody = document.getElementById('whitelist-table-body');
    let rows = '';
    
    if (currentWhitelist.length === 0) {
        rows = `<tr><td colspan="2" class="py-6 text-center text-slate-500 font-bold">הרשימה הלבנה ריקה</td></tr>`;
    } else {
        currentWhitelist.forEach(num => {
            rows += `
            <tr class="hover:bg-indigo-50/30 bg-white border-b border-slate-200 transition-colors">
                <td class="px-6 py-3 border-x border-slate-300 font-bold text-slate-700 text-lg tracking-wider" dir="ltr">${num}</td>
                <td class="px-6 py-3 border-x border-slate-300 text-center w-40">
                    <button onclick="editWhitelistNumber('${num}')" class="text-slate-400 hover:text-indigo-600 p-2 transition-colors" title="ערוך">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteWhitelistNumber('${num}')" class="text-slate-400 hover:text-red-500 p-2 transition-colors ml-2" title="מחק">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        });
    }
    tbody.innerHTML = rows;
}

async function addWhitelistNumber() {
    const input = document.getElementById('new-whitelist-num');
    const number = input.value.trim();
    
    if (!number) return alert('נא להזין מספר טלפון');
    
    const btn = document.getElementById('add-whitelist-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    try {
        const pass = localStorage.getItem('admin_pass');
        const res = await fetch(`${API_BASE}/phone-settings/whitelist/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Pass': pass },
            body: JSON.stringify({ number })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'שגיאה בהוספת המספר');
        
        input.value = '';
        currentWhitelist = data.data;
        document.getElementById('total-whitelist-count').innerText = currentWhitelist.length;
        renderWhitelist();
        
    } catch (error) {
        alert(error.message);
    } finally {
        btn.innerHTML = 'הוסף <i class="fas fa-plus mr-1"></i>';
        btn.disabled = false;
    }
}

async function deleteWhitelistNumber(number) {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את המספר ${number} מהרשימה המורשית?`)) return;
    
    try {
        const pass = localStorage.getItem('admin_pass');
        const res = await fetch(`${API_BASE}/phone-settings/whitelist/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Pass': pass },
            body: JSON.stringify({ number })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'שגיאה במחיקת המספר');
        
        currentWhitelist = data.data;
        document.getElementById('total-whitelist-count').innerText = currentWhitelist.length;
        renderWhitelist();
        
    } catch (error) {
        alert(error.message);
    }
}

async function editWhitelistNumber(oldNumber) {
    const newNumber = prompt(`עריכת מספר:\nאנא הזן את המספר החדש במקום ${oldNumber}`, oldNumber);
    
    if (!newNumber || newNumber.trim() === oldNumber) return;
    
    try {
        const pass = localStorage.getItem('admin_pass');
        const res = await fetch(`${API_BASE}/phone-settings/whitelist/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Pass': pass },
            body: JSON.stringify({ oldNumber: oldNumber, newNumber: newNumber.trim() })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'שגיאה בעדכון המספר');
        
        currentWhitelist = data.data;
        document.getElementById('total-whitelist-count').innerText = currentWhitelist.length;
        renderWhitelist();
        
    } catch (error) {
        alert(error.message);
    }
}
