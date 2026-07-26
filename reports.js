export async function handleReports(request, env) {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const filterValue = url.searchParams.get('value');

    let query = `
        SELECT a.date, a.time_arrived, a.late_minutes, s.code, s.first_name, s.last_name, s.class_name
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

    const { results } = await env.DB.prepare(query).bind(...params).all();
    
    return {
        report_type: type || 'all',
        total_records: results.length,
        data: results
    };
}
