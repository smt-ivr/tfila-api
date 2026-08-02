import { getSetting } from './utils.js';

// פונקציית עזר לקריאה ל-API של ימות המשיח
async function callYemotAPI(endpoint, params) {
    const url = new URL(`https://www.call2all.co.il/ym/api/${endpoint}`);
    
    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
    });
    
    return await response.json();
}

async function fetchCustomerData(token) {
    const data = await callYemotAPI('GetCustomerData', { token });
    if (data.responseStatus !== 'OK') throw new Error(data.message || 'שגיאה בשליפת נתוני לקוח משרת ימות המשיח');
    return data;
}

async function getActiveExtensionInfo(token) {
    const customerData = await fetchCustomerData(token);
    
    let primaryDid = customerData.mainDid;
    let targetExtension = null;

    if (customerData.secondary_dids && customerData.secondary_dids.length > 0) {
        const routedDid = customerData.secondary_dids.find(d => d.usage && d.usage.startsWith('goto:'));
        if (routedDid) {
            primaryDid = routedDid.did;
            targetExtension = routedDid.usage.replace('goto:', '');
        }
    }
    
    return { primaryDid, targetExtension, systemName: customerData.name };
}

async function fetchExtensionSettings(token, extensionPath) {
    const cleanPath = extensionPath.startsWith('/') ? extensionPath : '/' + extensionPath;
    const fullPath = `ivr2:${cleanPath}/ext.ini`;
    
    try {
        const data = await callYemotAPI('GetTextFile', { token, what: fullPath });
        if (data.responseStatus === 'OK' && data.contents) return data.contents;
        return "";
    } catch (e) {
        return ""; 
    }
}

async function fetchWhiteList(token, path) {
    try {
        const data = await callYemotAPI('GetTextFile', { token, what: path });
        if (data.responseStatus === 'OK' && data.contents) {
            return data.contents.split('\n').map(n => n.trim()).filter(n => n.length > 0);
        }
        return [];
    } catch (e) {
        return []; 
    }
}

async function saveWhiteList(token, path, numbersArray) {
    const contents = numbersArray.join('\n');
    const data = await callYemotAPI('UploadTextFile', { token, what: path, contents });
    if (data.responseStatus !== 'OK') throw new Error(data.message || 'שגיאה בשמירת הקובץ בימות המשיח');
}

export async function handlePhoneSettings(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    const token = await getSetting(env, 'yemot_token');
    const listPath = await getSetting(env, 'yemot_whitelist_path', 'ivr2:/888/WhiteList.ini');

    if (!token) throw new Error("טוקן התחברות לימות המשיח חסר בהגדרות המערכת. אנא הוסף yemot_token לטבלת settings.");

    // --- שאיבת מידע משולב (ניתוב + הגדרות שלוחה מלאות) לפתיחת העמוד ---
    if (request.method === 'GET' && path.endsWith('/phone-settings/routing-info')) {
        const info = await getActiveExtensionInfo(token);
        let extensionSettings = "";
        
        if (info.targetExtension) {
            extensionSettings = await fetchExtensionSettings(token, info.targetExtension);
        }
        
        return { 
            success: true, 
            data: {
                did: info.primaryDid,
                extension: info.targetExtension,
                extSettings: extensionSettings
            } 
        };
    }

    // --- עדכון רשימת המיילים בקובץ השלוחה (ext.ini) ---
    if (request.method === 'POST' && path.endsWith('/phone-settings/update-emails')) {
        const body = await request.json();
        const { emails } = body;
        
        const info = await getActiveExtensionInfo(token);
        if (!info.targetExtension) throw new Error("לא נמצאה שלוחה פעילה לעדכון המיילים");

        const extIni = await fetchExtensionSettings(token, info.targetExtension);
        let lines = extIni ? extIni.split('\n').map(l => l.trim()) : [];

        // מסירים את כל השורות הישנות של הגדרות המיילים
        lines = lines.filter(line => !/^api_add_\d+=email\d*=/i.test(line) && line !== '');

        // מציאת האינדקס הגבוה ביותר של api_add_ אחר כדי שלא נדרוס פרמטרים של המערכת
        let maxIndex = -1;
        lines.forEach(line => {
            const match = line.match(/^api_add_(\d+)=/i);
            if (match) {
                const idx = parseInt(match[1], 10);
                if (idx > maxIndex) maxIndex = idx;
            }
        });

        // הוספת המיילים החדשים
        let nextIdx = maxIndex + 1;
        emails.forEach((em, i) => {
            // הימות דורש email לראשון ו-email1, email2 לבאים
            const emailKey = i === 0 ? 'email' : `email${i}`;
            lines.push(`api_add_${nextIdx}=${emailKey}=${em}`);
            nextIdx++;
        });

        const newContents = lines.join('\n') + '\n';
        const cleanPath = info.targetExtension.startsWith('/') ? info.targetExtension : '/' + info.targetExtension;
        const fullPath = `ivr2:${cleanPath}/ext.ini`;

        const uploadRes = await callYemotAPI('UploadTextFile', { token, what: fullPath, contents: newContents });
        if (uploadRes.responseStatus !== 'OK') throw new Error(uploadRes.message || 'שגיאה בשמירת המיילים');

        return { success: true, message: "המיילים עודכנו בהצלחה" };
    }

    // --- קריאות לרשימה הלבנה ---
    if (request.method === 'GET' && path.endsWith('/phone-settings/whitelist')) {
        const numbers = await fetchWhiteList(token, listPath);
        return { success: true, data: numbers };
    }
    
    if (request.method === 'POST') {
        const body = await request.json();
        
        if (path.endsWith('/phone-settings/whitelist/add')) {
            const { number } = body;
            if (!number) throw new Error("מספר טלפון חסר");
            
            const numbers = await fetchWhiteList(token, listPath);
            if (numbers.includes(number)) return { success: true, message: "המספר כבר קיים ברשימה", data: numbers };
            
            numbers.push(number);
            await saveWhiteList(token, listPath, numbers);
            return { success: true, message: "המספר נוסף בהצלחה", data: numbers };
        }
        
        if (path.endsWith('/phone-settings/whitelist/update')) {
            const { oldNumber, newNumber } = body;
            if (!oldNumber || !newNumber) throw new Error("חסרים נתוני מספרי טלפון");
            
            let numbers = await fetchWhiteList(token, listPath);
            const index = numbers.indexOf(oldNumber);
            if (index === -1) throw new Error("המספר הישן לא נמצא ברשימה");
            
            numbers[index] = newNumber;
            numbers = [...new Set(numbers)];
            
            await saveWhiteList(token, listPath, numbers);
            return { success: true, message: "המספר עודכן בהצלחה", data: numbers };
        }
        
        if (path.endsWith('/phone-settings/whitelist/delete')) {
            const { number } = body;
            if (!number) throw new Error("מספר טלפון חסר");
            
            let numbers = await fetchWhiteList(token, listPath);
            numbers = numbers.filter(n => n !== number);
            
            await saveWhiteList(token, listPath, numbers);
            return { success: true, message: "המספר נמחק בהצלחה", data: numbers };
        }
    }

    throw new Error("נתיב או שיטה לא נתמכים בניהול הגדרות הטלפון");
}
