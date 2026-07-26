import { getCurrentIsraelTime, calculateLateMinutes, isSaturday } from './utils.js';
import { getSetting } from './settings.js';

export async function handleYemot(request, env) {
    const url = new URL(request.url);
    
    // ימות המשיח מעבירה נתונים ב-GET כברירת מחדל
    const studentCode = url.searchParams.get('student_code');
    const arrivalInput = url.searchParams.get('arrival_input');

    // שלב 1: בקשת קוד תלמיד (אם הלקוח רק חייג ונכנס לשלוחה)
    if (!studentCode) {
        // הפקודה read מבקשת מימות המשיח להקריא טקסט ולשמור את ההקשה במשתנה student_code
        return new Response("read=t-אנא_הקש_את_קוד_התלמיד=student_code,no,1,1,7,No,Yes,No", {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    // אימות שהתלמיד קיים במסד הנתונים
    const student = await env.DB.prepare("SELECT * FROM students WHERE code = ?").bind(studentCode).first();
    if (!student) {
        // קוד שגוי - נבקש שוב
        return new Response("read=t-קוד_שגוי_או_לא_קיים_במערכת_אנא_הקש_שנית=student_code,no,1,1,7,No,Yes,No", {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    const current = getCurrentIsraelTime();
    
    // חילוץ יום וחודש כדי להקריא את התאריך בצורה טבעית
    const [year, month, day] = current.date.split('-');

    // שלב 2: אם יש קוד תלמיד תקין אבל עדיין לא הוזן זמן ההגעה
    if (!arrivalInput) {
        // המרת רווחים לקווים תחתונים כי ימות המשיח לא תומכת ברווחים בהקראת TTS
        const studentName = `${student.first_name}_${student.last_name}`.replace(/ /g, '_');
        const dateString = `${day}_לחודש_${month}`;
        
        const welcomeMessage = `t-שלום_${studentName}_התאריך_היום_הוא_${dateString}_להגעה_עכשיו_הקש_כוכבית_להגעה_לפני_מספר_דקות_הקש_את_מספר_הדקות_להגעה_בשעה_מסויימת_הקש_את_השעה_בארבע_ספרות`;
        
        // נבקש מהמרכזייה לקבל את הנתון למשתנה arrival_input
        return new Response(`read=${welcomeMessage}=arrival_input,yes,1,1,4,No,Yes,No`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    // שלב 3: התקבל גם קוד תלמיד וגם קלט זמן. מעדכנים את המערכת.
    try {
        if (isSaturday(current.date)) {
            return new Response("id_list_message=t-לא_ניתן_להזין_נוכחות_ביום_שבת", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        let finalDate = current.date;
        let finalTime = current.time;

        if (arrivalInput === '*') {
            // הקיש כוכבית - 'עכשיו'. הערכים נשארים של הרגע הנוכחי.
        } else if (arrivalInput.length <= 3) {
            // הקיש מספר דקות (עד 3 ספרות למקרה של עיכוב ארוך)
            const mins = parseInt(arrivalInput, 10);
            if (isNaN(mins)) throw new Error("מספר לא תקין");
            
            const now = new Date();
            now.setMinutes(now.getMinutes() - mins);
            const opts = { timeZone: 'Asia/Jerusalem' };
            finalDate = new Intl.DateTimeFormat('en-CA', { ...opts, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
            finalTime = new Intl.DateTimeFormat('en-GB', { ...opts, hour12: false, hour: '2-digit', minute: '2-digit' }).format(now);
        } else if (arrivalInput.length === 4) {
            // הקיש 4 ספרות של שעה (לדוגמא 0830)
            const h = arrivalInput.substring(0, 2);
            const m = arrivalInput.substring(2, 4);
            finalTime = `${h}:${m}`;
        } else {
            return new Response("read=t-קלט_לא_תקין_אנא_נסה_שנית=arrival_input,yes,1,1,4,No,Yes,No", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        // בדיקה האם כבר קיימת נוכחות להיום כדי להחליט אם זה עדכון או רשומה חדשה
        const existingRecord = await env.DB.prepare(
            "SELECT id FROM attendance WHERE student_code = ? AND date = ?"
        ).bind(studentCode, finalDate).first();

        let ttsResponse = "t-הנוכחות_נרשמה_בהצלחה";
        
        if (existingRecord) {
            await env.DB.prepare(
                "UPDATE attendance SET time_arrived = ? WHERE id = ?"
            ).bind(finalTime, existingRecord.id).run();
            ttsResponse = "t-הנוכחות_עודכנה_בהצלחה";
        } else {
            await env.DB.prepare(
                "INSERT INTO attendance (student_code, date, time_arrived) VALUES (?, ?, ?)"
            ).bind(studentCode, finalDate, finalTime).run();
        }

        // חישוב איחור כדי להודיע בטלפון (אופציונלי - יושמע למתקשר)
        let targetTime = await getSetting(env, 'target_arrival_time') || '08:30';
        const lateMinutes = calculateLateMinutes(finalTime, targetTime);
        if (lateMinutes > 0) {
            ttsResponse += `_איחור_של_${lateMinutes}_דקות`;
        }

        // החזרת תשובת סיום מוצלחת לימות המשיח (המערכת תקריא ותנתק/תעבור שלוחה)
        return new Response(`id_list_message=${ttsResponse}`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });

    } catch (error) {
        return new Response(`id_list_message=t-שגיאת_מערכת_בהזנת_הנתונים`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}
