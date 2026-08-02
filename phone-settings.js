import { getSetting } from './utils.js';

// פונקציית עזר לקריאה ל-API של ימות המשיח
async function callYemotAPI(endpoint, params) {
    const url = new URL(`https://www.call2all.co.il/ym/api/${endpoint}`);
    
    // שימוש ב-POST עם URLSearchParams כדי למנוע בעיות של אורך URL או תווים מיוחדים
    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
    });
    
    const data = await response.json();
    return data;
}

// ---------------------------------------------------------
// פונקציות לניהול נתוני ניתוב ושלוחה
// ---------------------------------------------------------

// שאיבת נתוני הלקוח (כולל מספרי טלפון - DIDs)
async function fetchCustomerData(token) {
    const data = await callYemotAPI('GetCustomerData', { token });
    if (data.responseStatus !== 'OK') {
        throw new Error(data.message || 'שגיאה בשליפת נתוני לקוח משרת ימות המשיח');
    }
    return data;
}

// פונקציית עזר לאיתור השלוחה הפעילה אליה מנותב המספר
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

// שאיבת הגדרות שלוחה ספציפית (ext.ini)
async function fetchExtensionSettings(token, extensionPath) {
    // מוודאים שהנתיב מתחיל בלוכסן
    const cleanPath = extensionPath.startsWith('/') ? extensionPath : '/' + extensionPath;
    const fullPath = `ivr2:${cleanPath}/ext.ini`;
    
    try {
        const data = await callYemotAPI('GetTextFile', { token, what: fullPath });
        if (data.responseStatus === 'OK' && data.contents) {
            return data.contents;
        }
        return "";
    } catch (e) {
        return ""; // מחזירים מחרוזת ריקה במקרה של שגיאה או קובץ חסר
    }
}

// ---------------------------------------------------------
// פונקציות לניהול רשימה לבנה (WhiteList)
// ---------------------------------------------------------

// שאיבת הרשימה הלבנה
async function fetchWhiteList(token, path) {
    try {
        const data = await callYemotAPI('GetTextFile', { token, what: path });
        
        if (data.responseStatus === 'OK' && data.contents) {
            // פיצול לפי ירידת שורה, ניקוי רווחים וסינון שורות ריקות
            return data.contents.split('\n').map(n => n.trim()).filter(n => n.length > 0);
        }
        return [];
    } catch (e) {
        return []; // במידה ויש שגיאת תקשורת נחזיר רשימה ריקה כדי לא לתקוע את המערכת
    }
}

// שמירת הרשימה הלבנה (דריסה מלאה)
async function saveWhiteList(token, path, numbersArray) {
    const contents = numbersArray.join('\n');
    const data = await callYemotAPI('UploadTextFile', { token, what: path, contents });
    
    if (data.responseStatus !== 'OK') {
        throw new Error(data.message || 'שגיאה בשמירת הקובץ בשרת ימות המשיח');
    }
}


// פונקציה ראשית לניתוב בקשות ההגדרות
export async function handlePhoneSettings(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // משיכת הגדרות ימות המשיח ממסד הנתונים
    const token = await getSetting(env, 'yemot_token');
    // הגדרת ברירת מחדל אם הנתיב לא מוגדר במסד הנתונים
    const listPath = await getSetting(env, 'yemot_whitelist_path', 'ivr2:/888/WhiteList.ini');

    if (!token) {
        throw new Error("טוקן התחברות לימות המשיח חסר בהגדרות המערכת. אנא הוסף yemot_token לטבלת settings.");
    }

    // --- 1. קריאה נפרדת: שליפת מידע על המספר והניתוב בלבד ---
    if (request.method === 'GET' && path.endsWith('/phone-settings/routing-info')) {
        const info = await getActiveExtensionInfo(token);
        
        return { 
            success: true, 
            data: {
                did: info.primaryDid,
                extension: info.targetExtension,
                systemName: info.systemName
            } 
        };
    }

    // --- 2. קריאה נפרדת: שליפת התוכן של השלוחה (ללא צורך בהעברת נתיב) ---
    if (request.method === 'GET' && path.endsWith('/phone-settings/ext-settings')) {
        const info = await getActiveExtensionInfo(token);
        
        if (!info.targetExtension) {
            throw new Error("לא נמצאה שלוחה פעילה המוגדרת בנתב");
        }
        
        const extensionSettings = await fetchExtensionSettings(token, info.targetExtension);
        
        return { 
            success: true, 
            data: {
                extension: info.targetExtension,
                extSettings: extensionSettings
            } 
        };
    }

    // --- קריאות קיימות: ניהול רשימה לבנה ---
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
            if (numbers.includes(number)) {
                 return { success: true, message: "המספר כבר קיים ברשימה", data: numbers };
            }
            
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
            // הסרת כפילויות
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
