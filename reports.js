export async function handleReports(request, env) {
    const url = new URL(request.url);
    const type = url.searchParams.get('type'); // סוג הדוח: daily, monthly, student, class, all
    const filterValue = url.searchParams.get('value'); // ערך לסינון (תאריך, חודש, קוד תלמיד, שם כיתה)

    // שאילתה בסיסית שמביאה גם את פרטי התלמיד
    let query = `
        SELECT a.date, a.time_arrived, a.late_minutes, s.code, s.first_name, s.last_name, s.class_name
        FROM attendance a
        JOIN students s ON a.student_code = s.code
    `;
    let params = [];

    // סינונים דינמיים לפי בקשת הממשק
    if (type === 'daily' && filterValue) {
        query += " WHERE a.date = ?";
        params.push(filterValue); // פורמט YYYY-MM-DD
    } else if (type === 'monthly' && filterValue) {
        query += " WHERE a.date LIKE ?";
        params.push(`${filterValue}-%`); // פורמט YYYY-MM
    } else if (type === 'student' && filterValue) {
        query += " WHERE a.student_code = ?";
        params.push(filterValue);
    } else if (type === 'class' && filterValue) {
        query += " WHERE s.class_name = ?";
        params.push(filterValue);
    }

    // סידור התוצאות מהחדש לישן
    query += " ORDER BY a.date DESC, a.time_arrived DESC";

    const { results } = await env.DB.prepare(query).bind(...params).all();
    
    return {
        report_type: type || 'all',
        total_records: results.length,
        data: results
    };
}
