import { getCurrentIsraelTime, isSaturday } from './utils.js';
import { handleSendEmail } from './email.js';

async function getHebrewDateString(dateString) {
    try {
        const response = await fetch(`https://www.hebcal.com/converter?cfg=json&date=${dateString}&lg=h`);
        const data = await response.json();
        let parasha = "";
        
        if (data.events && data.events.length > 0) {
            const parashaEvent = data.events.find(e => {
                const cleanEvent = e.replace(/[\u0591-\u05C7]/g, ''); 
                return cleanEvent.includes(" ");
            });
            if (parashaEvent) parasha = parashaEvent.replace(/[\u0591-\u05C7]/g, '');
        }
        
        const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
        const dayName = days[new Date(dateString).getDay()];
        
        let resText = parasha ? `יום ${dayName} ${parasha}` : `יום ${dayName}`;
        return resText.replace(/\./g, ''); 
    } catch (error) {
        return ""; 
    }
}

function calculateCustomDate(currentDateStr, customInput) {
    const now = new Date(currentDateStr);
    if (customInput === '1') now.setDate(now.getDate() - 1);
    else if (customInput === '2') now.setDate(now.getDate() - 2);
    else if (customInput.length === 4) {
        const day = parseInt(customInput.substring(0, 2), 10);
        const month = parseInt(customInput.substring(2, 4), 10);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            now.setMonth(month - 1);
            now.setDate(day);
        } else return null;
    } else return null;
    
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export async function handleYemot(request, env) {
    const url = new URL(request.url);
    
    const reportType = url.searchParams.get('report_type'); 
    const customDateInput = url.searchParams.get('custom_date_input'); 
    const finalReportType = url.searchParams.get('final_report_type'); 
    
    const current = getCurrentIsraelTime();
    
    if (reportType === '0') {
        const email = url.searchParams.get('email');
        if (!email) {
            return new Response("id_list_message=t-שגיאה בשליחת אימייל&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
        try {
            await handleSendEmail(request, env);
            return new Response("id_list_message=t-האימייל נשלח בהצלחה&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        } catch (e) {
            return new Response("id_list_message=t-שגיאה בשליחת אימייל&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
    }

    let effectiveDate = current.date;
    if (reportType === '3' && customDateInput) {
        const calcDate = calculateCustomDate(current.date, customDateInput);
        if (calcDate) effectiveDate = calcDate;
        else return new Response("id_list_message=t-תאריך שגוי&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    
    if (isSaturday(effectiveDate)) {
        return new Response("id_list_message=t-לא ניתן לדווח בשבת&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const actualType = (reportType === '3') ? finalReportType : reportType;

    if (!reportType) {
        const dateText = await getHebrewDateString(current.date);
        const welcomeMessage = dateText 
            ? `t-${dateText},t-לאיחור הקש 1,t-לחיסור הקש 2,t-לתאריך אחר הקש 3`
            : `t-לאיחור הקש 1,t-לחיסור הקש 2,t-לתאריך אחר הקש 3,t-לשליחת אימייל הקש 0`;
        return new Response(`read=${welcomeMessage}=report_type,,1,,,NO,,,,1230,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (reportType === '3' && !customDateInput) {
        const datePrompt = "t-אנא הקש תאריך";
        return new Response(`read=${datePrompt}=custom_date_input,,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (reportType === '3' && customDateInput && !finalReportType) {
        const dateText = await getHebrewDateString(effectiveDate);
        const prompt = dateText 
            ? `t-${dateText},t-לאיחור הקש 1,t-לחיסור הקש 2`
            : `t-לאיחור הקש 1,t-לחיסור הקש 2`;
        return new Response(`read=${prompt}=final_report_type,,1,,,NO,,,,120,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // זיהוי דינמי של השלב והפרמטרים בהתאם לסוג הדיווח
    let paramPrefix = 'input_data_';
    if (actualType === '1') paramPrefix = 'late_data_';
    else if (actualType === '2') paramPrefix = 'absence_data_';

    let lastIndex = 0;
    let inputData = null;

    if (actualType === '1' || actualType === '2') {
        // רצים כדי למצוא את המספר הגבוה ביותר שנמצא בכתובת ה-URL
        for (let i = 1; i <= 200; i++) {
            if (url.searchParams.has(paramPrefix + i)) {
                lastIndex = i;
                inputData = url.searchParams.get(paramPrefix + i);
            } else {
                break;
            }
        }
    } else {
        inputData = url.searchParams.get('input_data');
    }

    let nextIndex = lastIndex + 1;

    if (!inputData) {
        if (actualType === '2') return new Response(`read=t-הקש קוד תלמיד=${paramPrefix}${nextIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        else if (actualType === '1') return new Response(`read=t-הקש קוד תלמיד כוכבית ומספר דקות=${paramPrefix}${nextIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        else return new Response("id_list_message=t-שגיאה&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // יציאה וחזרה לתיקייה הקודמת במקרה של הקשת כוכבית בלבד
    if (inputData === '*') {
        return new Response("go_to_folder=.&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    try {
        let studentCode = inputData;
        let minutes = null;

        if (actualType === '1') { 
            const parts = inputData.split('*');
            if (parts.length < 2) return new Response(`read=t-הקשה שגויה,t-נסה שוב=${paramPrefix}${nextIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            studentCode = parts[0];
            minutes = parseInt(parts[1], 10);
            if (isNaN(minutes)) return new Response(`read=t-הקשה שגויה,t-נסה שוב=${paramPrefix}${nextIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        const student = await env.DB.prepare("SELECT * FROM students WHERE code = ?").bind(studentCode).first();
        if (!student) return new Response(`read=t-תלמיד לא נמצא,t-נסה שוב=${paramPrefix}${nextIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

        const typeDb = actualType === '2' ? 'absence' : 'late';

        if (actualType === '1' && minutes === 0) {
            await env.DB.prepare("DELETE FROM exceptions WHERE student_code = ? AND date = ?").bind(studentCode, effectiveDate).run();
            // מבקש נתון נוסף אחרי מחיקה מוצלחת
            return new Response(`read=t-נמחק,t-הקש נתון נוסף=${paramPrefix}${nextIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        const existingRecord = await env.DB.prepare("SELECT id FROM exceptions WHERE student_code = ? AND date = ?").bind(studentCode, effectiveDate).first();

        await env.DB.prepare(`
            INSERT INTO exceptions (student_code, date, type, minutes) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_code, date) 
            DO UPDATE SET type = excluded.type, minutes = excluded.minutes
        `).bind(studentCode, effectiveDate, typeDb, minutes).run();

        const actionVerb = existingRecord ? "עודכן" : "נרשם";
        let successMessage = typeDb === 'absence' ? `t-${actionVerb} חיסור לתלמיד ${student.first_name} ${student.last_name}` : `t-${actionVerb} איחור לתלמיד ${student.first_name} ${student.last_name} של ${minutes} דקות`;

        // השמעת הודעת הצלחה וקריאה מידית לקלט נוסף בפרמטר הבא בתור
        return new Response(`read=${successMessage},t-הקש נתון נוסף=${paramPrefix}${nextIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        
    } catch (error) {
        return new Response(`read=t-שגיאת מערכת,t-נסה שוב=${paramPrefix}${nextIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
}
