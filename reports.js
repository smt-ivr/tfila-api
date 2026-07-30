import { getCurrentIsraelTime, getWeekRange } from './utils.js';

async function getWeeklyHebrewInfo(weekStartDate) {
    try {
        const d = new Date(weekStartDate);
        d.setDate(d.getDate() + 6); 
        const saturdayStr = d.toISOString().split('T')[0];
        
        const response = await fetch(`https://www.hebcal.com/converter?cfg=json&date=${saturdayStr}&lg=h`);
        const data = await response.json();
        
        let parasha = "";
        let heYear = data.heDateParts ? data.heDateParts.y : "";

        if (data.events) {
            const parashaEvent = data.events.find(e => {
                const clean = e.replace(/[\u0591-\u05C7]/g, '');
                return clean.includes("פרשת");
            });
            if (parashaEvent) parasha = parashaEvent.replace(/[\u0591-\u05C7\.]/g, ''); 
        }
        return { parasha, heYear };
    } catch (e) {
        return { parasha: "", heYear: "" };
    }
}

export async function getWeeklyData(env, targetDate) {
    const { start, end } = getWeekRange(targetDate);
    const today = getCurrentIsraelTime().date;
    
    const { parasha, heYear } = await getWeeklyHebrewInfo(start);
    
    // סידור התלמידים מספרית לפי הקוד
    const { results: students } = await env.DB.prepare(
        "SELECT * FROM students ORDER BY CAST(code AS INTEGER), class_name, first_name"
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
        
        // הצגת ימים רק אם הם קטנים או שווים לזמן האמיתי של השרת
        if (dateStr <= today) {
            daysToShow.push({ index: i, name: dayNames[i], dateStr });
        }
    }

    const report = students.map(student => {
        const studentExceptions = exceptions.filter(e => e.student_code === student.code);
        const weeklyStatus = {};
        
        // עוברים רק על הימים שבאמת קיימים / עברו
        daysToShow.forEach(day => {
            const exceptionToday = studentExceptions.find(e => e.date === day.dateStr);
            
            if (exceptionToday) {
                const type = exceptionToday.type || 'ok';
                const badBehavior = exceptionToday.bad_behavior === 1;
                let behaviorMark = '';
                
                if (badBehavior) {
                    behaviorMark = 'ב';
                } else if (type === 'ok' || type === 'late') {
                    behaviorMark = 'א'; 
                } else if (type === 'absence') {
                    behaviorMark = '';  
                }

                weeklyStatus[day.index] = { 
                    type: type, 
                    minutes: exceptionToday.minutes,
                    badBehavior: badBehavior,
                    behaviorMark: behaviorMark
                };
            } else {
                weeklyStatus[day.index] = { 
                    type: 'ok', 
                    minutes: null,
                    badBehavior: false,
                    behaviorMark: 'א'
                };
            }
        });

        return {
            code: student.code,
            first_name: student.first_name,
            last_name: student.last_name,
            class_name: student.class_name,
            weeklyStatus
        };
    });

    return { weekStart: start, weekEnd: end, parasha, heYear, daysToShow, report };
}

export async function handleReports(request, env) {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date') || getCurrentIsraelTime().date;
    const data = await getWeeklyData(env, dateParam);
    return data;
}
