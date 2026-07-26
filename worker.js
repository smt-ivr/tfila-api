import { handleCheckin } from './checkin.js';
import { handleReports } from './reports.js';
import { handleSettings } from './settings.js';
import { handleStudents } from './students.js';
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
                
                // חסימה ותשובה מסודרת: בדיקה האם קוד התלמיד כבר קיים במערכת
                const existingStudent = await env.DB.prepare(
                    "SELECT code FROM students WHERE code = ?"
                ).bind(code).first();
                
                if (existingStudent) {
                    // החזרת תשובה מסודרת עם סטטוס 400 (בקשה לא תקינה)
                    return jsonResponse({ 
                        error: `שגיאה: קוד תלמיד '${code}' כבר קיים במערכת עבור תלמיד אחר. לא ניתן להזין קוד כפול.` 
                    }, 400);
                }
                
                await env.DB.prepare(
                    "INSERT INTO students (code, first_name, last_name, class_name) VALUES (?, ?, ?, ?)"
                ).bind(code, first_name, last_name, class_name).run();
                return jsonResponse({ message: "התלמיד נוסף בהצלחה" });
            }

            return jsonResponse({ error: "הנתיב לא קיים במערכת", requested_path: path }, 404);

        } catch (error) {
            // לכידת שגיאות כללית למקרה של נפילות שרת אחרות (כדי שלא יקרוס)
            return jsonResponse({ error: "שגיאת שרת פנימית: " + error.message }, 500);
        }
    }
};
