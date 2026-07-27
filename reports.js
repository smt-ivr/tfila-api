import { getCurrentIsraelTime, getWeekRange } from './utils.js';

export async function getWeeklyData(env, targetDate) {
    const { start, end } = getWeekRange(targetDate);
    
    // שליפת כל התלמידים
    const { results: students } = await env.DB.prepare(
        "SELECT * FROM students ORDER BY class_name, first_name"
    ).all();
    
    // שליפת כל החריגים בטווח השבוע
    const { results: exceptions } = await env.DB.prepare(
        "SELECT * FROM exceptions WHERE date >= ? AND date <= ?"
    ).bind(start, end).all();

    // בניית מבנה נתונים שבועי לכל תלמיד
    const report = students.map(student => {
        const studentExceptions = exceptions.filter(e => e.student_code === student.code);
        const weeklyStatus = {};
        
        // מעבר על ימים 0 (ראשון) עד 5 (שישי)
        for (let i = 0; i <= 5; i++) {
            const currentDay = new Date(start);
            currentDay.setDate(currentDay.getDate() + i);
            const dateStr = currentDay.toISOString().split('T')[0];
            
            const exceptionToday = studentExceptions.find(e => e.date === dateStr);
            if (exceptionToday) {
                weeklyStatus[i] = { type: exceptionToday.type, minutes: exceptionToday.minutes };
            } else {
                weeklyStatus[i] = { type: 'ok', minutes: null }; // נוכח
            }
        }

        return {
            ...student,
            weeklyStatus
        };
    });

    return { weekStart: start, weekEnd: end, report };
}

export async function handleReports(request, env) {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date') || getCurrentIsraelTime().date;
    
    const data = await getWeeklyData(env, dateParam);
    return data;
}
