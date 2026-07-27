import { getCurrentIsraelTime, isSaturday } from './utils.js';

export async function handleYemot(request, env) {
    const url = new URL(request.url);
    
    const reportType = url.searchParams.get('report_type'); // 1 = חיסור, 2 = איחור
    const inputData = url.searchParams.get('input_data'); // קוד תלמיד (או קוד*דקות)
    
    const current = getCurrentIsraelTime();
    
    if (isSaturday(current.date)) {
        return new Response("id_list_message=t-לא ניתן להזין נתונים ביום שבת&", {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    // שלב 1: בחירת סוג דיווח
    if (!reportType) {
        const [year, month, day] = current.date.split('-');
        const dateString = `${day} לחודש ${month}`;
        
        const welcomeMessage = `t-שלום, התאריך היום הוא ${dateString}, לדיווח חיסור הקישו 1, לדיווח איחור הקישו 2`;
        return new Response(`read=${welcomeMessage}=report_type,,,,,NO,,,,,,,,,no`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    // שלב 2: בקשת קוד תלמיד (ודקות אם צריך)
    if (!inputData) {
        let promptMessage = "";
        if (reportType === '1') {
            promptMessage = "t-הקש את קוד התלמיד ולסיום סולמית";
        } else if (reportType === '2') {
            promptMessage = "t-הקש את קוד התלמיד, כוכבית, ואת דקות האיחור ולסיום סולמית";
        } else {
            return new Response("read=t-בחירה שגויה, לדיווח חיסור הקישו 1, לדיווח איחור הקישו 2=report_type,,,,,NO,,,,,,,,,no", {
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

        if (reportType === '2') {
            // הפרדת קוד התלמיד והדקות באמצעות הכוכבית
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

        const typeDb = reportType === '1' ? 'absence' : 'late';

        // הוספה או עדכון דריסה של דיווח קודם באותו יום
        await env.DB.prepare(`
            INSERT INTO exceptions (student_code, date, type, minutes) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_code, date) 
            DO UPDATE SET type = excluded.type, minutes = excluded.minutes
        `).bind(studentCode, current.date, typeDb, minutes).run();

        const successMessage = reportType === '1' ? "t-החיסור דווח בהצלחה" : "t-האיחור דווח בהצלחה";
        return new Response(`id_list_message=${successMessage}&`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });

    } catch (error) {
        return new Response(`id_list_message=t-שגיאת מערכת בהזנת הנתונים&`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}
