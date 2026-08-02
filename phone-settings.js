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

// שמירת הרשימה הלבנה (הדריסה מתבצעת על כל הקובץ כנדרש לאחר השאיבה)
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

    // שליפת רשימת המספרים
    if (request.method === 'GET' && path.endsWith('/phone-settings/whitelist')) {
        const numbers = await fetchWhiteList(token, listPath);
        return { success: true, data: numbers };
    }
    
    // פעולות עריכה (הוספה, עדכון, מחיקה)
    if (request.method === 'POST') {
        const body = await request.json();
        
        // הוספת מספר
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
        
        // עדכון/עריכת מספר קיים
        if (path.endsWith('/phone-settings/whitelist/update')) {
            const { oldNumber, newNumber } = body;
            if (!oldNumber || !newNumber) throw new Error("חסרים נתוני מספרי טלפון");
            
            let numbers = await fetchWhiteList(token, listPath);
            const index = numbers.indexOf(oldNumber);
            if (index === -1) throw new Error("המספר הישן לא נמצא ברשימה");
            
            numbers[index] = newNumber;
            // הסרת כפילויות למקרה שהמספר החדש כבר קיים במערך
            numbers = [...new Set(numbers)];
            
            await saveWhiteList(token, listPath, numbers);
            return { success: true, message: "המספר עודכן בהצלחה", data: numbers };
        }
        
        // מחיקת מספר
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
