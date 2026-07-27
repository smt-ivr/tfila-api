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
                return cleanEvent.includes("פרשת");
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
    const inputData = url.searchParams.get('input_data'); 
    
    const current = getCurrentIsraelTime();
    
    // --- שלב 0: שליחת אימייל (אם נבחרה שלוחה 4) ---
    if (reportType === '4') {
        const email = url.searchParams.get('email');
        if (!email) {
            return new Response("id_list_message=t-אין אימייל לשליחה&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
        try {
            await handleSendEmail(request, env);
            return new Response("id_list_message=t-הדוח נשלח בהצלחה&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        } catch (e) {
            return new Response("id_list_message=t-שגיאה בשליחת האימייל&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
    }

    let effectiveDate = current.date;
    if (reportType === '3' && customDateInput) {
        const calcDate = calculateCustomDate(current.date, customDateInput);
        if (calcDate) effectiveDate = calcDate;
        else return new Response("id_list_message=t-תאריך לא תקין השלוחה תתנתק&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    
    if (isSaturday(effectiveDate)) {
        return new Response("id_list_message=t-לא ניתן להזין נתונים ליום שבת השלוחה תתנתק&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const actualType = (reportType === '3') ? finalReportType : reportType;

    if (!reportType) {
        const hebDateText = await getHebrewDateString(current.date);
        const welcomeMessage = hebDateText 
            ? `t-${hebDateText}, לדיווח איחור הקישו 1, לדיווח חיסור הקישו 2, לדיווח על יום אחר הקישו 3, לשליחת דוח למייל הקישו 4`
            : `t-לדיווח איחור הקישו 1, לדיווח חיסור הקישו 2, לדיווח על יום אחר הקישו 3, לשליחת דוח למייל הקישו 4`; 
        return new Response(`read=${welcomeMessage}=report_type,,1,,,NO,,,,120,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (reportType === '3' && !customDateInput) {
        const datePrompt = "t-נא בחר את התאריך הרצוי בארבע ספרות יום וחודש או הקישו 1 וסולמית לאתמול או 2 וסולמית לשלשום";
        return new Response(`read=${datePrompt}=custom_date_input,,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (reportType === '3' && customDateInput && !finalReportType) {
        const hebDateText = await getHebrewDateString(effectiveDate);
        const prompt = hebDateText 
            ? `t-${hebDateText}, לדיווח איחור הקישו 1, לדיווח חיסור הקישו 2`
            : `t-לדיווח איחור הקישו 1, לדיווח חיסור הקישו 2`;
        return new Response(`read=${prompt}=final_report_type,,1,,,NO,,,,120,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (!inputData) {
        if (actualType === '2') return new Response("read=t-הקש את קוד התלמיד ולסיום סולמית=input_data,,,,,NO,,,,,,,,,no", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        else if (actualType === '1') return new Response("read=t-הקש את קוד התלמיד כוכבית ואת דקות האיחור ולסיום סולמית=input_data,,,,,NO,,,,,,,,,no", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        else return new Response("id_list_message=t-בחירה שגויה השלוחה תתנתק&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    try {
        let studentCode = inputData;
        let minutes = null;

        if (actualType === '1') { 
            const parts = inputData.split('*');
            if (parts.length < 2) return new Response("id_list_message=t-הקלט שגוי חסר כוכבית או דקות איחור הדיווח לא נשמר&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            studentCode = parts[0];
            minutes = parseInt(parts[1], 10);
            if (isNaN(minutes)) return new Response("id_list_message=t-מספר דקות לא תקין הדיווח לא נשמר&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        const student = await env.DB.prepare("SELECT * FROM students WHERE code = ?").bind(studentCode).first();
        if (!student) return new Response("id_list_message=t-קוד תלמיד שגוי או לא קיים במערכת הדיווח לא נשמר&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

        const typeDb = actualType === '2' ? 'absence' : 'late';

        const existingRecord = await env.DB.prepare("SELECT id FROM exceptions WHERE student_code = ? AND date = ?").bind(studentCode, effectiveDate).first();

        await env.DB.prepare(`
            INSERT INTO exceptions (student_code, date, type, minutes) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_code, date) 
            DO UPDATE SET type = excluded.type, minutes = excluded.minutes
        `).bind(studentCode, effectiveDate, typeDb, minutes).run();

        const actionVerb = existingRecord ? "עדכנתם בהצלחה" : "דיווחתם בהצלחה";
        let successMessage = typeDb === 'absence' ? `t-${actionVerb} לתלמיד ${student.first_name} ${student.last_name} חיסור` : `t-${actionVerb} לתלמיד ${student.first_name} ${student.last_name} איחור של ${minutes} דקות`;

        return new Response(`id_list_message=${successMessage}&`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } catch (error) {
        return new Response(`id_list_message=t-שגיאת מערכת בהזנת הנתונים&`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
}
