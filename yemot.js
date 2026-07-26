import { getCurrentIsraelTime, calculateLateMinutes, isSaturday } from './utils.js';
import { getSetting } from './settings.js';

export async function handleYemot(request, env) {
    const url = new URL(request.url);
    
    // קבלת הנתונים מימות המשיח
    const studentCode = url.searchParams.get('student_code');
    const arrivalInput = url.searchParams.get('arrival_input');

    // שלב 1: בקשת קוד תלמיד
    if (!studentCode) {
        return new Response("read=t-אנא הקש את קוד התלמיד ולסיום סולמית=student_code,,,,,NO,,,,,,,,,no", {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    // אימות שהתלמיד קיים במסד הנתונים
    const student = await env.DB.prepare("SELECT * FROM students WHERE code = ?").bind(studentCode).first();
    if (!student) {
        return new Response("read=t-קוד שגוי או לא קיים במערכת אנא הקש שנית ולסיום סולמית=student_code,,,,,NO,,,,,,,,,no", {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    const current = getCurrentIsraelTime();
    
    // חילוץ יום וחודש
    const [year, month, day] = current.date.split('-');

    // שלב 2: הקראת השם, התאריך ובקשת זמן ההגעה
    if (!arrivalInput) {
        const studentName = `${student.first_name} ${student.last_name}`;
        const dateString = `${day} לחודש ${month}`;
        
        const welcomeMessage = `t-שלום ${studentName}, התאריך היום הוא ${dateString}, להגעה עכשיו הקש כוכבית, להגעה לפני מספר דקות הקש את מספר הדקות ולסיום סולמית, להגעה בשעה מסויימת הקש את השעה בארבע ספרות ולסיום סולמית`;
        
        return new Response(`read=${welcomeMessage}=arrival_input,,,,,NO,,,,,,,,,no`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    // שלב 3: התקבל גם קוד תלמיד וגם קלט זמן. מעדכנים את המערכת.
    try {
        if (isSaturday(current.date)) {
            // הוספת & בסוף
            return new Response("id_list_message=t-לא ניתן להזין נוכחות ביום שבת&", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        let finalDate = current.date;
        let finalTime = current.time;

        if (arrivalInput === '*') {
            // הקיש כוכבית - 'עכשיו'
        } else if (arrivalInput.length <= 3) {
            // הקיש מספר דקות
            const mins = parseInt(arrivalInput, 10);
            if (isNaN(mins)) throw new Error("מספר לא תקין");
            
            const now = new Date();
            now.setMinutes(now.getMinutes() - mins);
            const opts = { timeZone: 'Asia/Jerusalem' };
            finalDate = new Intl.DateTimeFormat('en-CA', { ...opts, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
            finalTime = new Intl.DateTimeFormat('en-GB', { ...opts, hour12: false, hour: '2-digit', minute: '2-digit' }).format(now);
        } else if (arrivalInput.length === 4) {
            // הקיש 4 ספרות של שעה
            const h = arrivalInput.substring(0, 2);
            const m = arrivalInput.substring(2, 4);
            finalTime = `${h}:${m}`;
        } else {
            return new Response("read=t-קלט לא תקין אנא נסה שנית ולסיום סולמית=arrival_input,,,,,NO,,,,,,,,,no", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        const existingRecord = await env.DB.prepare(
            "SELECT id FROM attendance WHERE student_code = ? AND date = ?"
        ).bind(studentCode, finalDate).first();

        let ttsResponse = "t-הנוכחות נרשמה בהצלחה";
        
        if (existingRecord) {
            await env.DB.prepare(
                "UPDATE attendance SET time_arrived = ? WHERE id = ?"
            ).bind(finalTime, existingRecord.id).run();
            ttsResponse = "t-הנוכחות עודכנה בהצלחה";
        } else {
            await env.DB.prepare(
                "INSERT INTO attendance (student_code, date, time_arrived) VALUES (?, ?, ?)"
            ).bind(studentCode, finalDate, finalTime).run();
        }

        // הוספת הודעת איחור במידת הצורך
        let targetTime = await getSetting(env, 'target_arrival_time') || '08:30';
        const lateMinutes = calculateLateMinutes(finalTime, targetTime);
        if (lateMinutes > 0) {
            ttsResponse += `, איחור של ${lateMinutes} דקות`;
        }

        // הוספת & בסוף
        return new Response(`id_list_message=${ttsResponse}&`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });

    } catch (error) {
        // הוספת & בסוף
        return new Response(`id_list_message=t-שגיאת מערכת בהזנת הנתונים&`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}
