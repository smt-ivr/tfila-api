import { getCurrentIsraelTime, getWeekRange } from './utils.js';

export async function getWeeklyData(env, targetDate) {
    const { start, end } = getWeekRange(targetDate);
    const today = getCurrentIsraelTime().date;
    
    // שליפת תלמידים וחריגים
    const { results: students } = await env.DB.prepare(
        "SELECT * FROM students ORDER BY class_name, last_name, first_name"
    ).all();
    
    const { results: exceptions } = await env.DB.prepare(
        "SELECT * FROM exceptions WHERE date >= ? AND date <= ?"
    ).bind(start, end).all();

    // בניית מערך של הימים שצריך להציג (רק עד היום הנוכחי)
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
    const daysToShow = [];
    
    for (let i = 0; i <= 5; i++) {
        const currentDay = new Date(start);
        currentDay.setDate(currentDay.getDate() + i);
        const dateStr = currentDay.toISOString().split('T')[0];
        
        // מוסיף את היום לדוח רק אם הוא היום או תאריך שעבר
        if (dateStr <= today) {
            daysToShow.push({ index: i, name: dayNames[i], dateStr });
        }
    }
    
    // הגנת נפילה: אם מבקשים בטעות שבוע עתידי לגמרי, נציג את כל הימים כדי לא להחזיר דוח ריק
    if (daysToShow.length === 0) {
        for (let i = 0; i <= 5; i++) daysToShow.push({ index: i, name: dayNames[i] });
    }

    const report = students.map(student => {
        const studentExceptions = exceptions.filter(e => e.student_code === student.code);
        const weeklyStatus = {};
        
        for (let i = 0; i <= 5; i++) {
            const currentDay = new Date(start);
            currentDay.setDate(currentDay.getDate() + i);
            const dateStr = currentDay.toISOString().split('T')[0];
            
            const exceptionToday = studentExceptions.find(e => e.date === dateStr);
            if (exceptionToday) {
                weeklyStatus[i] = { type: exceptionToday.type, minutes: exceptionToday.minutes };
            } else {
                weeklyStatus[i] = { type: 'ok', minutes: null };
            }
        }

        return {
            code: student.code,
            first_name: student.first_name,
            last_name: student.last_name,
            class_name: student.class_name,
            weeklyStatus
        };
    });

    return { weekStart: start, weekEnd: end, daysToShow, report };
}

export async function handleReports(request, env) {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date') || getCurrentIsraelTime().date;
    const data = await getWeeklyData(env, dateParam);
    return data;
}
