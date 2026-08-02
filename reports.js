import { getCurrentIsraelTime, getWeekRange, getSetting } from './utils.js';

export async function getWeeklyHebrewInfo(weekStartDate) {
    try {
        const fetches = [];
        for(let i = 0; i <= 6; i++) {
            const d = new Date(weekStartDate);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            
            fetches.push(
                fetch(`https://www.hebcal.com/converter?cfg=json&date=${dateStr}&lg=h&i=on`)
                    .then(r => r.json())
                    .then(data => ({ dateStr, data }))
            );
        }
        
        const results = await Promise.all(fetches);
        
        let heYear = "";
        let parasha = "";
        const hebDates = {};

        for (const item of results) {
            const data = item.data;
            
            const cleanHebrewDate = (data.hebrew || "").replace(/[\u0591-\u05C7]/g, '');
            hebDates[item.dateStr] = cleanHebrewDate;
            
            if (data.heDateParts && !heYear) {
                heYear = data.heDateParts.y;
            }
            if (data.events && !parasha) {
                const parashaEvent = data.events.find(e => {
                    const clean = e.replace(/\u05BE/g, '-').replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '');
                    return clean.includes("פרשת");
                });
                
                if (parashaEvent) {
                    parasha = parashaEvent.replace(/\u05BE/g, '-').replace(/[\u0591-\u05BD\u05BF-\u05C7\.]/g, ''); 
                }
            }
        }
        return { parasha, heYear, hebDates };
    } catch (e) {
        return { parasha: "", heYear: "", hebDates: {} };
    }
}

export async function getWeeklyData(env, targetDate) {
    const systemStartDate = await getSetting(env, 'system_start_date', '2000-01-01');
    const isBeforeStart = targetDate < systemStartDate;

    const { start, end } = getWeekRange(targetDate);
    
    // משיכת הזמן הנוכחי והשבוע הנוכחי האמיתי
    const today = getCurrentIsraelTime().date;
    const { start: currentWeekStart } = getWeekRange(today);
    
    // זיהוי ברמת השרת איזה שבוע אנחנו מציגים עכשיו
    const isCurrentWeek = (start === currentWeekStart);
    const isFutureWeek = (start > currentWeekStart);
    
    const { parasha, heYear, hebDates } = await getWeeklyHebrewInfo(start);
    
    // יצירת מערך הימים כדי שהתצוגה (כותרות) תוכל להשתמש בתאריכים העבריים
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
    const daysToShow = [];
    
    for (let i = 0; i <= 5; i++) {
        const currentDay = new Date(start);
        currentDay.setDate(currentDay.getDate() + i);
        const dateStr = currentDay.toISOString().split('T')[0];
        
        let shortHebDate = hebDates[dateStr] || "";
        if(shortHebDate) {
            const parts = shortHebDate.split(' ');
            if(parts.length > 2) {
                shortHebDate = parts.slice(0, -1).join(' '); 
            }
        }

        const isToday = (dateStr === today);
        const isFuture = (dateStr > today);

        // אם המערכת טרם התחילה, נניח שאין חופשות עדיין
        daysToShow.push({ 
            index: i, 
            name: dayNames[i], 
            dateStr,
            hebDate: shortHebDate,
            isVacation: false,
            isToday: isToday,
            isFuture: isFuture
        });
    }

    // אם התאריך לפני תחילת המערכת, נחזיר את כל הנתונים הכלליים עם דוח ריק והודעה
    if (isBeforeStart) {
        return {
            success: false,
            isBeforeStart: true,
            message: "המערכת טרם התחילה לפעול בתאריך זה",
            weekStart: start,
            weekEnd: end,
            parasha,
            heYear,
            isCurrentWeek,
            isFutureWeek,
            daysToShow,
            report: []
        };
    }

    // המשך שליפת נתונים מהמסד רק אם המערכת כבר התחילה לעבוד בתאריך זה
    const { results: students } = await env.DB.prepare(
        "SELECT * FROM students ORDER BY CAST(code AS INTEGER), class_name, first_name"
    ).all();
    
    const { results: exceptions } = await env.DB.prepare(
        "SELECT * FROM exceptions WHERE date >= ? AND date <= ?"
    ).bind(start, end).all();

    const { results: vacations } = await env.DB.prepare(
        "SELECT date FROM vacations WHERE date >= ? AND date <= ?"
    ).bind(start, end).all();
    const vacationDates = vacations.map(v => v.date);

    // עדכון ימי החופשה במערך הימים
    daysToShow.forEach(day => {
        day.isVacation = vacationDates.includes(day.dateStr);
    });

    const report = students.map(student => {
        const studentExceptions = exceptions.filter(e => e.student_code === student.code);
        const weeklyStatus = {};
        
        daysToShow.forEach(day => {
            const exceptionToday = studentExceptions.find(e => e.date === day.dateStr);
            
            if (exceptionToday) {
                const type = exceptionToday.type || 'ok';
                const badBehavior = exceptionToday.bad_behavior === 1;
                let behaviorMark = 'א'; 
                
                if (badBehavior) {
                    behaviorMark = 'ב';
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

    return { 
        weekStart: start, 
        weekEnd: end, 
        parasha, 
        heYear, 
        isCurrentWeek,
        isFutureWeek,
        daysToShow, 
        report 
    };
}

export async function handleReports(request, env) {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date') || getCurrentIsraelTime().date;
    const data = await getWeeklyData(env, dateParam);
    return data;
}
