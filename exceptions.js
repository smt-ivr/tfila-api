import { getCurrentIsraelTime, isSaturday } from './utils.js';

export async function handleExceptions(request, env) {
    const body = await request.json();
    const { code, type, minutes, date: specificDate } = body;

    if (!code) throw new Error("חסר קוד תלמיד");
    if (!['absence', 'late'].includes(type)) throw new Error("סוג חריגה לא תקין");
    if (type === 'late' && !minutes) throw new Error("חובה להזין דקות איחור");

    const student = await env.DB.prepare("SELECT * FROM students WHERE code = ?").bind(code).first();
    if (!student) throw new Error("תלמיד לא נמצא במערכת");

    const finalDate = specificDate || getCurrentIsraelTime().date;

    if (isSaturday(finalDate)) {
        throw new Error("לא ניתן להזין חריגים ליום שבת");
    }

    const minsToSave = type === 'late' ? parseInt(minutes, 10) : null;

    // במידה ויש כבר דיווח לאותו יום, זה יתעדכן (למשל מאיחור לחיסור)
    await env.DB.prepare(`
        INSERT INTO exceptions (student_code, date, type, minutes) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(student_code, date) 
        DO UPDATE SET type = excluded.type, minutes = excluded.minutes
    `).bind(code, finalDate, type, minsToSave).run();

    return {
        message: "הדיווח נרשם/עודכן בהצלחה",
        student: `${student.first_name} ${student.last_name}`,
        date: finalDate,
        type: type === 'absence' ? 'חיסור' : 'איחור',
        minutes: minsToSave
    };
}
