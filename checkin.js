import { getCurrentIsraelTime, calculateLateMinutes, isSaturday } from './utils.js';
import { getSetting } from './settings.js';

export async function handleCheckin(request, env) {
    const body = await request.json();
    const { code, mode = 'now', minutes, date: specificDate, time: specificTime } = body;

    if (!code) throw new Error("חסר קוד תלמיד");

    const student = await env.DB.prepare("SELECT * FROM students WHERE code = ?").bind(code).first();
    if (!student) throw new Error("תלמיד לא נמצא במערכת");

    let finalDate;
    let finalTime;

    if (mode === 'now') {
        const current = getCurrentIsraelTime();
        finalDate = current.date;
        finalTime = current.time;
    } 
    else if (mode === 'minutes_ago') {
        const minsToSubtract = parseInt(minutes, 10);
        if (isNaN(minsToSubtract)) throw new Error("מספר הדקות אינו תקין");
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - minsToSubtract);
        
        const opts = { timeZone: 'Asia/Jerusalem' };
        finalDate = new Intl.DateTimeFormat('en-CA', { ...opts, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
        finalTime = new Intl.DateTimeFormat('en-GB', { ...opts, hour12: false, hour: '2-digit', minute: '2-digit' }).format(now);
    } 
    else if (mode === 'specific') {
        if (!specificDate || !specificTime) throw new Error("חסר תאריך או שעה");
        finalDate = specificDate;
        finalTime = specificTime;
    }

    if (isSaturday(finalDate)) {
        throw new Error("לא ניתן להזין נוכחות ליום שבת (היום ה-6 בשבוע)");
    }

    // אנו עדיין שולפים ומחשבים פה כדי להחזיר לממשק המשתמש (HTML) הודעה כמה דקות הוא איחר עכשיו
    let targetTime = await getSetting(env, 'target_arrival_time') || '08:30';
    const lateMinutes = calculateLateMinutes(finalTime, targetTime);

    const existingRecord = await env.DB.prepare(
        "SELECT id FROM attendance WHERE student_code = ? AND date = ?"
    ).bind(code, finalDate).first();

    let isUpdate = false;

    if (existingRecord) {
        // עדכון רק של שעת ההגעה (ללא late_minutes)
        await env.DB.prepare(
            "UPDATE attendance SET time_arrived = ? WHERE id = ?"
        ).bind(finalTime, existingRecord.id).run();
        isUpdate = true;
    } else {
        // הכנסה רק של התאריך ושעת ההגעה
        await env.DB.prepare(
            "INSERT INTO attendance (student_code, date, time_arrived) VALUES (?, ?, ?)"
        ).bind(code, finalDate, finalTime).run();
    }

    return {
        message: isUpdate ? "נוכחות עודכנה בהצלחה (שינוי נתונים קיימים)" : "נוכחות נרשמה בהצלחה",
        student: `${student.first_name} ${student.last_name}`,
        date: finalDate,
        time_arrived: finalTime,
        late_minutes: lateMinutes, // מחזירים רק כמידע לממשק, לא נשמר בטבלה
        is_update: isUpdate
    };
}
