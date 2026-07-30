import { handleExceptions } from './exceptions.js';
import { handleReports } from './reports.js';
import { handleStudents, handleBulkUpdate } from './students.js';
import { handleYemot } from './yemot.js';
import { handleSendEmail } from './email.js';
import { getCurrentIsraelTime } from './utils.js';
import { getAdminHTML } from './admin-ui.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Pass',
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
            // מסלולים פומביים לחלוטין
            if (path.endsWith('/yemot')) return await handleYemot(request, env);
            if (path.endsWith('/system-time') && request.method === 'GET') return jsonResponse({ message: "זמן שרת", ...getCurrentIsraelTime() });
            
            // מסלול הגשת ממשק הניהול הויזואלי
            if (path === '/' || path === '/tfila' || path === '/tfila/') {
                if (request.method === 'GET') {
                    return new Response(getAdminHTML(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
                }
            }

            // --- מערכת אימות ---
            const passHeader = request.headers.get('X-Admin-Pass');
            const passQuery = url.searchParams.get('code');
            const providedPass = passHeader || passQuery; // תמיכה גם בהדר וגם בפרמטר URL
            
            let realPass = null;
            try {
                // משיכת הסיסמה ממסד הנתונים בלבד - ללא סיסמה בקוד
                const dbPassRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_password'").first();
                if (dbPassRow) realPass = dbPassRow.value;
            } catch (e) {}

            // טיפול בבקשת התחברות מהאתר
            if (path.endsWith('/login') && request.method === 'POST') {
                if (!realPass) return jsonResponse({ error: "המערכת טרם הוגדרה. אנא הוסף סיסמה במסד הנתונים." }, 500);
                
                const body = await request.json();
                if (body.password === realPass) return jsonResponse({ success: true });
                return jsonResponse({ error: "סיסמה שגויה" }, 401);
            }

            // חסימת הגישה אם אין סיסמה תקינה או אם השרת לא הוגדר
            if (!realPass || providedPass !== realPass) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            // --- מסלולים מוגנים (דורשים סיסמה תקינה) ---
            if (path.endsWith('/send-email') && request.method === 'POST') {
                const result = await handleSendEmail(request, env);
                return jsonResponse(result);
            }

            if (path.endsWith('/exception') && request.method === 'POST') {
                const result = await handleExceptions(request, env);
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
            
            if (path.endsWith('/add-student') && request.method === 'POST') {
                const { code, first_name, last_name, class_name } = await request.json();
                const existingStudent = await env.DB.prepare("SELECT code FROM students WHERE code = ?").bind(code).first();
                if (existingStudent) return jsonResponse({ error: "קוד תלמיד כבר קיים." }, 400);
                
                await env.DB.prepare("INSERT INTO students (code, first_name, last_name, class_name) VALUES (?, ?, ?, ?)").bind(code, first_name, last_name, class_name).run();
                return jsonResponse({ message: "התלמיד נוסף בהצלחה" });
            }

            if (path.endsWith('/update-student') && request.method === 'POST') {
                const { code, first_name, last_name, class_name } = await request.json();
                await env.DB.prepare("UPDATE students SET first_name = ?, last_name = ?, class_name = ? WHERE code = ?").bind(first_name, last_name, class_name, code).run();
                return jsonResponse({ message: "פרטי התלמיד עודכנו" });
            }

            if (path.endsWith('/delete-student') && request.method === 'POST') {
                const { code } = await request.json();
                await env.DB.prepare("DELETE FROM exceptions WHERE student_code = ?").bind(code).run();
                await env.DB.prepare("DELETE FROM students WHERE code = ?").bind(code).run();
                return jsonResponse({ message: "התלמיד וכל נתוניו נמחקו לצמיתות" });
            }

            if (path.endsWith('/bulk-update-students') && request.method === 'POST') {
                const result = await handleBulkUpdate(request, env);
                return jsonResponse(result);
            }

            return jsonResponse({ error: "הנתיב לא קיים במערכת", requested_path: path }, 404);

        } catch (error) {
            return jsonResponse({ error: "שגיאת שרת פנימית: " + error.message }, 500);
        }
    }
};
