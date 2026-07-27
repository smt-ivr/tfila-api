import { getCurrentIsraelTime, isSaturday } from './utils.js';

// פונקציית עזר למשיכת התאריך העברי מ-Hebcal (יום ופרשה בלבד, כולל התמודדות עם ניקוד)
async function getHebrewDateString(dateString) {
    try {
        const response = await fetch(`https://www.hebcal.com/converter?cfg=json&date=${dateString}&lg=h`);
        const data = await response.json();
        
        let parasha = "";
        if (data.events && data.events.length > 0) {
            // חיפוש הפרשה תוך כדי הסרת הניקוד כדי שההשוואה תעבוד כראוי
            const parashaEvent = data.events.find(e => {
                const cleanEvent = e.replace(/[\u0591-\u05C7]/g, ''); // מסיר את כל סימני הניקוד
                return cleanEvent.includes("פרשת");
            });
            
            if (parashaEvent) {
                // מסירים את הניקוד גם מהתוצאה הסופית כדי שימות המשיח יקריא את זה חלק
                parasha = parashaEvent.replace(/[\u0591-\u05C7]/g, '');
            }
        }
        
        // המרת היום בשבוע לעברית
        const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
        const dayName = days[new Date(dateString).getDay()];

        // הרכבת המחרוזת הסופית (ללא השנה)
        if (parasha) {
            return `יום ${dayName} ${parasha}`;
        } else {
            return `יום ${dayName}`;
        }
    } catch (error) {
        console.error("Hebcal API error:", error);
        return ""; // קריסה שקטה: המערכת תמשיך לעבוד גם בלי התאריך במקרה של שגיאה
    }
}

export async function handleYemot(request, env) {
    const url = new URL(request.url);
    
    const reportType = url.searchParams.get('report_type'); // 1 = איחור, 2 = חיסור
    const inputData = url.searchParams.get('input_data'); // קוד תלמיד (או קוד*דקות)
    
    const current = getCurrentIsraelTime();
    
    if (isSaturday(current.date)) {
        return new Response("id_list_message=t-לא ניתן להזין נתונים ביום שבת&", {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    // שלב 1: בחירת סוג דיווח
    if (!reportType) {
        // משיכת התאריך המלא מה-API
        const hebDateText = await getHebrewDateString(current.date);
        
        const welcomeMessage = hebDateText 
            ? `t-שלום, התאריך היום ${hebDateText} לדיווח איחור הקישו 1, לדיווח חיסור הקישו 2`
            : `t-שלום, לדיווח איחור הקישו 1, לדיווח חיסור הקישו 2`; // פולבק במקרה של שגיאת רשת
            
        return new Response(`read=${welcomeMessage}=report_type,,1,,,NO,,,,120,,,,,no`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    // שלב 2: בקשת קוד תלמיד (ודקות אם מדובר באיחור)
    if (!inputData) {
        let promptMessage = "";
        if (reportType === '2') { // חיסור
            promptMessage = "t-הקש את קוד התלמיד ולסיום סולמית";
        } else if (reportType === '1') { // איחור
            promptMessage = "t-הקש את קוד התלמיד, כוכבית, ואת דקות האיחור ולסיום סולמית";
        } else {
            return new Response("read=t-בחירה שגויה, לדיווח איחור הקישו 1, לדיווח חיסור הקישו 2=report_type,,1,,,NO,,,,120,,,,,no", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }
        
        return new Response(`read=${promptMessage}=input_data,,,,,NO,,,,,,,,,no`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    // שלב 3: עיבוד הנתונים שהתקבלו ושמירה במסד
    try {
        let studentCode = inputData;
        let minutes = null;

        if (reportType === '1') { // איחור
            const parts = inputData.split('*');
            if (parts.length < 2) {
                 return new Response("read=t-הקלט שגוי. הקש קוד תלמיד, כוכבית, דקות איחור ולסיום סולמית=input_data,,,,,NO,,,,,,,,,no", {
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }
            studentCode = parts[0];
            minutes = parseInt(parts[1], 10);
            if (isNaN(minutes)) throw new Error("invalid_minutes");
        }

        const student = await env.DB.prepare("SELECT * FROM students WHERE code = ?").bind(studentCode).first();
        if (!student) {
            return new Response("read=t-קוד תלמיד שגוי או לא קיים, אנא נסה שנית ולסיום סולמית=input_data,,,,,NO,,,,,,,,,no", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        const typeDb = reportType === '2' ? 'absence' : 'late';

        // הוספה או עדכון דריסה של דיווח קודם באותו יום
        await env.DB.prepare(`
            INSERT INTO exceptions (student_code, date, type, minutes) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_code, date) 
            DO UPDATE SET type = excluded.type, minutes = excluded.minutes
        `).bind(studentCode, current.date, typeDb, minutes).run();

        const successMessage = reportType === '2' ? "t-החיסור דווח בהצלחה" : "t-האיחור דווח בהצלחה";
        return new Response(`id_list_message=${successMessage}&`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });

    } catch (error) {
        return new Response(`id_list_message=t-שגיאת מערכת בהזנת הנתונים&`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}
