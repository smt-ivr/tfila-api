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
