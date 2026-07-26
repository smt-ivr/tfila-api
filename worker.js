import { handleCheckin } from './checkin.js';
import { handleReports } from './reports.js';
import { handleSettings } from './settings.js';
import { handleStudents } from './students.js';
import { handleYemot } from './yemot.js'; // ייבוא הנתיב של ימות המשיח
import { getCurrentIsraelTime } from './utils.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}

export default {
    async fetch(request, env, ctx) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // נתיב מיוחד עבור ימות המשיח (מחזיר טקסט רגיל ולא JSON)
            if (path.endsWith('/yemot')) {
                return await handleYemot(request, env);
            }

            if (path.endsWith('/system-time') && request.method === 'GET') {
                return jsonResponse({ message: "זמן שרת", ...getCurrentIsraelTime() });
            }

            if (path.endsWith('/checkin') && request.method === 'POST') {
                const result = await handleCheckin(request, env);
                return jsonResponse(result);
            }

            if (path.endsWith('/reports') && request.method === 'GET') {
                const result = await handleReports(request, env);
                return jsonResponse(result);
            }
            
            if (path.endsWith('/students') && request.method === 'GET') {
                const result = await handleStudents(request, env);
                return jsonResponse(result);
            }

            if (path.endsWith('/settings')) {
                const result = await handleSettings(request, env);
                return jsonResponse(result);
            }
            
            if (path.endsWith('/add-student') && request.method === 'POST') {
                const { code, first_name, last_name, class_name } = await request.json();
                
                const existingStudent = await env.DB.prepare(
                    "SELECT code FROM students WHERE code = ?"
                ).bind(code).first();
                
                if (existingStudent) {
                    return jsonResponse({ 
                        error: `שגיאה: קוד תלמיד '${code}' כבר קיים במערכת עבור תלמיד אחר. לא ניתן להזין קוד כפול.` 
                    }, 400);
                }
                
                await env.DB.prepare(
                    "INSERT INTO students (code, first_name, last_name, class_name) VALUES (?, ?, ?, ?)"
                ).bind(code, first_name, last_name, class_name).run();
                return jsonResponse({ message: "התלמיד נוסף בהצלחה" });
            }

            if (path.endsWith('/update-student') && request.method === 'POST') {
                const { code, first_name, last_name, class_name } = await request.json();
                
                await env.DB.prepare(
                    "UPDATE students SET first_name = ?, last_name = ?, class_name = ? WHERE code = ?"
                ).bind(first_name, last_name, class_name, code).run();
                
                return jsonResponse({ message: "פרטי התלמיד עודכנו בהצלחה" });
            }

            if (path.endsWith('/delete-student') && request.method === 'POST') {
                const { code } = await request.json();
                
                await env.DB.prepare("DELETE FROM attendance WHERE student_code = ?").bind(code).run();
                await env.DB.prepare("DELETE FROM students WHERE code = ?").bind(code).run();
                
                return jsonResponse({ message: "התלמיד וכל נתוני הנוכחות שלו נמחקו לצמיתות" });
            }

            return jsonResponse({ error: "הנתיב לא קיים במערכת", requested_path: path }, 404);

        } catch (error) {
            return jsonResponse({ error: "שגיאת שרת פנימית: " + error.message }, 500);
        }
    }
};
