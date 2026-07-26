import { getCurrentIsraelTime, calculateLateMinutes } from './utils.js';
import { getSetting } from './settings.js';

export async function handleCheckin(request, env) {
    const body = await request.json();
    const studentCode = body.code;

    if (!studentCode) {
        throw new Error("חסר קוד תלמיד");
    }

    // אימות שהתלמיד קיים
    const student = await env.DB.prepare("SELECT * FROM students WHERE code = ?").bind(studentCode).first();
    if (!student) {
        throw new Error("תלמיד לא נמצא במערכת");
    }

    // לקיחת הזמן העכשווי והשעה הרצויה מהמסד
    const { date, time } = getCurrentIsraelTime();
    let targetTime = await getSetting(env, 'target_arrival_time');
    if (!targetTime) targetTime = '08:30'; // גיבוי למקרה שמשהו נמחק

    // חישוב איחור
    const lateMinutes = calculateLateMinutes(time, targetTime);

    // שמירה במסד
    await env.DB.prepare(
        "INSERT INTO attendance (student_code, date, time_arrived, late_minutes) VALUES (?, ?, ?, ?)"
    ).bind(studentCode, date, time, lateMinutes).run();

    return {
        message: "נוכחות נרשמה בהצלחה",
        student: `${student.first_name} ${student.last_name}`,
        date: date,
        time_arrived: time,
        target_time: targetTime,
        late_minutes: lateMinutes
    };
}
