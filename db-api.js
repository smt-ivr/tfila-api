export async function handleDatabaseQuery(request, env) {
    try {
        const body = await request.json();
        const query = body.query;

        if (!query || typeof query !== 'string') {
            return { error: "שאילתה ריקה או לא חוקית" };
        }

        // הרצת השאילתה מול מסד הנתונים
        const result = await env.DB.prepare(query).all();

        return { 
            success: true, 
            results: result.results,
            meta: result.meta 
        };
    } catch (error) {
        // תפיסת שגיאות SQL (למשל תחביר שגוי) והחזרתן בצורה מסודרת
        return { 
            success: false, 
            error: error.message 
        };
    }
}
