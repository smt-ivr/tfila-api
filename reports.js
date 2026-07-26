import { calculateLateMinutes } from './utils.js';
import { getSetting } from './settings.js';

export async function handleReports(request, env) {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const filterValue = url.searchParams.get('value');

    // השאילתה לא מביאה late_minutes כי השדה כבר לא רלוונטי מהמסד
    let query = `
        SELECT a.date, a.time_arrived, s.code, s.first_name, s.last_name, s.class_name
        FROM attendance a
        JOIN students s ON a.student_code = s.code
    `;
    let params = [];

    if (type === 'daily' && filterValue) {
        query += " WHERE a.date = ?";
        params.push(filterValue);
    } else if (type === 'monthly' && filterValue) {
        query += " WHERE a.date LIKE ?";
        params.push(`${filterValue}-%`);
    } else if (type === 'student' && filterValue) {
        query += " WHERE a.student_code = ?";
        params.push(filterValue);
    } else if (type === 'class' && filterValue) {
        query += " WHERE s.class_name = ?";
        params.push(filterValue);
    }

    query += " ORDER BY a.date DESC, a.time_arrived DESC";

    // שליפת הנתונים הגולמיים ממסד הנתונים
    const { results } = await env.DB.prepare(query).bind(...params).all();
    
    // משיכת שעת היעד הנוכחית מההגדרות (או 08:30 כברירת מחדל) כדי לחשב דינמית את האיחור
    const targetTime = await getSetting(env, 'target_arrival_time') || '08:30';

    // מעבר על כל הרשומות וחישוב "על המקום" של דקות האיחור
    const enrichedResults = results.map(row => {
        return {
            ...row,
            late_minutes: calculateLateMinutes(row.time_arrived, targetTime)
        };
    });
    
    return {
        report_type: type || 'all',
        total_records: enrichedResults.length,
        data: enrichedResults // החזרת הנתונים אחרי החישוב הדינמי
    };
}
