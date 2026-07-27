import { getCurrentIsraelTime, getWeekRange } from './utils.js';

// פונקציה חדשה ששולפת את פרשת השבוע לפי התאריך של שבת
async function getWeeklyParasha(weekStartDate) {
    try {
        const d = new Date(weekStartDate);
        d.setDate(d.getDate() + 6); // מוסיף 6 ימים כדי להגיע ליום שבת
        const saturdayStr = d.toISOString().split('T')[0];
        
        const response = await fetch(`https://www.hebcal.com/converter?cfg=json&date=${saturdayStr}&lg=h`);
        const data = await response.json();
        
        if (data.events) {
            const parashaEvent = data.events.find(e => {
                const clean = e.replace(/[\u0591-\u05C7]/g, '');
                return clean.includes("פרשת");
            });
            if (parashaEvent) return parashaEvent.replace(/[\u0591-\u05C7\.]/g, ''); // מסיר ניקוד ונקודות
        }
        return "";
    } catch (e) {
        return "";
    }
}

export async function getWeeklyData(env, targetDate) {
    const { start, end } = getWeekRange(targetDate);
    const today = getCurrentIsraelTime().date;
    
    // שליפת הפרשה לשבוע הנוכחי
    const parasha = await getWeeklyParasha(start);
    
    const { results: students } = await env.DB.prepare(
        "SELECT * FROM students ORDER BY class_name, last_name, first_name"
    ).all();
    
    const { results: exceptions } = await env.DB.prepare(
        "SELECT * FROM exceptions WHERE date >= ? AND date <= ?"
    ).bind(start, end).all();

    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
    const daysToShow = [];
    
    for (let i = 0; i <= 5; i++) {
        const currentDay = new Date(start);
        currentDay.setDate(currentDay.getDate() + i);
        const dateStr = currentDay.toISOString().split('T')[0];
        
        if (dateStr <= today) {
            daysToShow.push({ index: i, name: dayNames[i], dateStr });
        }
    }
    
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

    // מחזיר עכשיו גם את הפרשה ל-Frontend
    return { weekStart: start, weekEnd: end, parasha, daysToShow, report };
}

export async function handleReports(request, env) {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date') || getCurrentIsraelTime().date;
    const data = await getWeeklyData(env, dateParam);
    return data;
}
