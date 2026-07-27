try {
        let studentCode = inputData;
        let minutes = null;

        if (actualType === '1') { 
            const parts = inputData.split('*');
            if (parts.length < 2) return new Response("id_list_message=t-הקלט שגוי חסר כוכבית או דקות איחור הדיווח לא נשמר&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            studentCode = parts[0];
            minutes = parseInt(parts[1], 10);
            if (isNaN(minutes)) return new Response("id_list_message=t-מספר דקות לא תקין הדיווח לא נשמר&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        const student = await env.DB.prepare("SELECT * FROM students WHERE code = ?").bind(studentCode).first();
        if (!student) return new Response("id_list_message=t-קוד תלמיד שגוי או לא קיים במערכת הדיווח לא נשמר&", { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

        const typeDb = actualType === '2' ? 'absence' : 'late';

        // לוגיקה חכמה: אם זה דיווח איחור של 0 דקות, אנחנו בעצם מסמנים שהתלמיד הגיע בזמן ומוחקים את החריגה
        if (actualType === '1' && minutes === 0) {
            await env.DB.prepare("DELETE FROM exceptions WHERE student_code = ? AND date = ?").bind(studentCode, effectiveDate).run();
            return new Response(`id_list_message=t-עודכן בהצלחה לתלמיד ${student.first_name} ${student.last_name} הגעה בזמן&`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        const existingRecord = await env.DB.prepare("SELECT id FROM exceptions WHERE student_code = ? AND date = ?").bind(studentCode, effectiveDate).first();

        await env.DB.prepare(`
            INSERT INTO exceptions (student_code, date, type, minutes) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_code, date) 
            DO UPDATE SET type = excluded.type, minutes = excluded.minutes
        `).bind(studentCode, effectiveDate, typeDb, minutes).run();

        const actionVerb = existingRecord ? "עדכנתם בהצלחה" : "דיווחתם בהצלחה";
        let successMessage = typeDb === 'absence' ? `t-${actionVerb} לתלמיד ${student.first_name} ${student.last_name} חיסור` : `t-${actionVerb} לתלמיד ${student.first_name} ${student.last_name} איחור של ${minutes} דקות`;

        return new Response(`id_list_message=${successMessage}&`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } catch (error) {
        return new Response(`id_list_message=t-שגיאת מערכת בהזנת הנתונים&`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
