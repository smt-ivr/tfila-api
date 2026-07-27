import { getCurrentIsraelTime, isSaturday } from './utils.js';
import { handleSendEmail } from './email.js';

async function getHebrewDateString(dateString) {
    try {
        const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
        const dayName = days[new Date(dateString).getDay()];
        return `יום ${dayName}`;
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
            return new Response("id_list_message=t-כתובת אימייל חסרה&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
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
        return new Response("id_list_message=t-לא ניתן להזין נתונים בשבת&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const actualType = (reportType === '3') ? finalReportType : reportType;

    if (!reportType) {
        const dateText = await getHebrewDateString(current.date);
        const welcomeMessage = dateText 
            ? `t-${dateText}, להזנת איחורים הקישו 1, להזנת חיסורים הקישו 2, לתאריך אחר הקישו 3, לשליחת דוח שבועי למייל הקישו 0`
            : `t-להזנת איחורים הקישו 1, להזנת חיסורים הקישו 2, לתאריך אחר הקישו 3, לשליחת דוח שבועי למייל הקישו 0`;
        
        return new Response(`read=${welcomeMessage}=report_type,,1,,,NO,,,,1230,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (reportType === '3' && !customDateInput) {
        const datePrompt = "t-הקישו 1 לאתמול, 2 לשלשום, או תאריך מותאם של ארבע ספרות יום וחודש";
        return new Response(`read=${datePrompt}=custom_date_input,,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (reportType === '3' && customDateInput && !finalReportType) {
        const dateText = await getHebrewDateString(effectiveDate);
        const prompt = dateText 
            ? `t-${dateText}, להזנת איחורים הקישו 1, להזנת חיסורים הקישו 2`
            : `t-להזנת איחורים הקישו 1, להזנת חיסורים הקישו 2`;
        return new Response(`read=${prompt}=final_report_type,,1,,,NO,,,,120,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // בחירת התחילית לפי סוג הדיווח - לאיחורים late_data ולחיסורים abs_data
    const prefix = actualType === '2' ? 'abs_data' : 'late_data';
    let currentIndex = 1;
    let latestInput = null;

    // מציאת הפרמטר האחרון שסופק ב-URL (הלולאה תמצא את המספר האחרון ותקדם את המונה להבא בתור)
    while (url.searchParams.has(`${prefix}_${currentIndex}`)) {
        latestInput = url.searchParams.get(`${prefix}_${currentIndex}`);
        currentIndex++;
    }

    // אם עדיין לא הוקש נתון כלשהו לשלב זה, נבקש את הנתון הראשון
    if (currentIndex === 1) {
        if (actualType === '2') {
            return new Response(`read=t-נא להקיש קוד תלמיד לחיסור, ולסיום הקישו כוכבית=${prefix}_1,,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        } else if (actualType === '1') {
            return new Response(`read=t-נא להקיש קוד תלמיד לאיחור, כוכבית, ומספר הדקות. ולסיום הקישו כוכבית=${prefix}_1,,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        } else {
            return new Response("id_list_message=t-שגיאה בסוג דוח&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
    }

    // בדיקת תנאי יציאה למערכת בחזרה לתיקיה
    if (latestInput === '*') {
        return new Response("go_to_folder=.&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    try {
        let studentCode = latestInput;
        let minutes = null;

        if (actualType === '1') {
            const parts = latestInput.split('*');
            if (parts.length < 2) {
                // שגיאה בפורמט – מבקש שוב עם הפרמטר של השלב הבא
                return new Response(`read=t-שגיאה בפורמט. נא להקיש קוד תלמיד כוכבית ומספר דקות, או כוכבית לסיום=${prefix}_${currentIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            }
            studentCode = parts[0];
            minutes = parseInt(parts[1], 10);
            
            if (isNaN(minutes)) {
                // שגיאה בדקות - מבקש שוב
                return new Response(`read=t-שגיאה במספר הדקות. נסו שוב או הקישו כוכבית לסיום=${prefix}_${currentIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            }
        }

        const student = await env.DB.prepare("SELECT * FROM students WHERE code = ?").bind(studentCode).first();
        
        if (!student) {
             // תלמיד לא נמצא – מבקש שוב
             return new Response(`read=t-תלמיד לא נמצא. נסו שוב או הקישו כוכבית לסיום=${prefix}_${currentIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        const typeDb = actualType === '2' ? 'absence' : 'late';

        if (actualType === '1' && minutes === 0) {
            await env.DB.prepare("DELETE FROM exceptions WHERE student_code = ? AND date = ?").bind(studentCode, effectiveDate).run();
            // ביטול איחור – מבקש את התלמיד הבא
            return new Response(`read=t-בוטל איחור עבור ${student.first_name} ${student.last_name}. להזנת תלמיד נוסף הקישו נתונים, או כוכבית לסיום=${prefix}_${currentIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        const existingRecord = await env.DB.prepare("SELECT id FROM exceptions WHERE student_code = ? AND date = ?").bind(studentCode, effectiveDate).first();

        await env.DB.prepare(`
            INSERT INTO exceptions (student_code, date, type, minutes) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_code, date) 
            DO UPDATE SET type = excluded.type, minutes = excluded.minutes
        `).bind(studentCode, effectiveDate, typeDb, minutes).run();

        const actionVerb = existingRecord ? "עודכן" : "נשמר";
        let successMessage = typeDb === 'absence' 
            ? `t-${actionVerb} חיסור עבור ${student.first_name} ${student.last_name}. לתלמיד נוסף הקישו מספר זיהוי, או כוכבית לסיום` 
            : `t-${actionVerb} איחור עבור ${student.first_name} ${student.last_name} ${minutes} דקות. להזנת איחור נוסף הקישו נתונים, או כוכבית לסיום`;

        // שמירה מוצלחת – מעבר חלק לבקשת התלמיד הבא
        return new Response(`read=${successMessage}=${prefix}_${currentIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

    } catch (error) {
        return new Response(`read=t-שגיאת מערכת. נסו שוב או הקישו כוכבית לסיום=${prefix}_${currentIndex},,,,,NO,,,,,,,,,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
}
