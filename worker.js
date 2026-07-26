import { handleCheckin } from './checkin.js';
import { handleReports } from './reports.js';
import { handleSettings } from './settings.js';
import { getCurrentIsraelTime } from './utils.js';

// הגדרות CORS כדי לאפשר לממשק HTML מקומי לדבר עם השרת
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// פונקציית עזר להחזרת תשובות מסודרות
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}

export default {
    async fetch(request, env, ctx) {
        // טיפול אוטומטי בבקשות Preflight של הדפדפן (חובה עבור HTML מקומי)
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // שימוש ב-endsWith כדי להתעלם מקידומות כמו /tfila/api/
            
            // ניתוב לבדיקת מצב השעון של השרת
            if (path.endsWith('/system-time') && request.method === 'GET') {
                const currentTime = getCurrentIsraelTime();
                return jsonResponse({
                    message: "זמן שרת נוכחי",
                    ...currentTime
                });
            }

            // ניתוב לרישום הגעה
            if (path.endsWith('/checkin') && request.method === 'POST') {
                const result = await handleCheckin(request, env);
                return jsonResponse(result);
            }

            // ניתוב לדוחות
            if (path.endsWith('/reports') && request.method === 'GET') {
                const result = await handleReports(request, env);
                return jsonResponse(result);
            }

            // ניתוב להגדרות המערכת
            if (path.endsWith('/settings')) {
                const result = await handleSettings(request, env);
                return jsonResponse(result);
            }
            
            // ניתוב להוספת תלמיד ידנית
            if (path.endsWith('/add-student') && request.method === 'POST') {
                const { code, first_name, last_name, class_name } = await request.json();
                await env.DB.prepare(
                    "INSERT INTO students (code, first_name, last_name, class_name) VALUES (?, ?, ?, ?)"
                ).bind(code, first_name, last_name, class_name).run();
                return jsonResponse({ message: "התלמיד נוסף בהצלחה" });
            }

            // נתיב לא ידוע
            return jsonResponse({ error: "הנתיב לא קיים במערכת", requested_path: path }, 404);

        } catch (error) {
            // טיפול מרכזי בשגיאות בכל האפליקציה
            return jsonResponse({ error: error.message }, 500);
        }
    }
};
