import { getCurrentIsraelTime } from './utils.js';

export async function handleReports(request, env) {
    const url = new URL(request.url);
    // ברירת מחדל: התאריך של היום
    const targetDate = url.searchParams.get('date') || getCurrentIsraelTime().date;

    const query = `
        SELECT s.code, s.first_name, s.last_name, s.class_name,
               e.type, e.minutes
        FROM students s
        LEFT JOIN exceptions e ON s.code = e.student_code AND e.date = ?
        ORDER BY s.class_name, s.first_name
    `;

    const { results } = await env.DB.prepare(query).bind(targetDate).all();
    
    const processedResults = results.map(row => {
        let status = 'נוכח'; // ברירת מחדל
        if (row.type === 'absence') status = 'חיסור';
        if (row.type === 'late') status = 'איחור';

        return {
            code: row.code,
            first_name: row.first_name,
            last_name: row.last_name,
            class_name: row.class_name,
            status: status,
            minutes: row.minutes || null
        };
    });
    
    return {
        date: targetDate,
        total_students: processedResults.length,
        data: processedResults 
    };
}
