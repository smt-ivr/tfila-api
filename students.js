export async function handleStudents(request, env) {
    if (request.method === "GET") {
        const { results } = await env.DB.prepare(
            "SELECT * FROM students ORDER BY class_name, first_name"
        ).all();
        
        return {
            total_students: results.length,
            data: results
        };
    }
}

export async function handleBulkUpdate(request, env) {
    const { studentCodes, className } = await request.json();
    
    if (!studentCodes || !Array.isArray(studentCodes) || studentCodes.length === 0) {
        throw new Error("לא נבחרו תלמידים לעדכון");
    }
    if (!className) {
        throw new Error("חסר שם כיתה לעדכון");
    }

    // Cloudflare D1 תומך בהרצת פקודות במקביל (batch)
    const stmts = studentCodes.map(code => 
        env.DB.prepare("UPDATE students SET class_name = ? WHERE code = ?").bind(className, code)
    );
    
    await env.DB.batch(stmts);
    
    return { message: `עודכנו בהצלחה ${studentCodes.length} תלמידים לכיתה ${className}` };
}
