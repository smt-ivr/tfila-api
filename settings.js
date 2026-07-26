export async function getSetting(env, key) {
    const result = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
    return result ? result.value : null;
}

export async function handleSettings(request, env) {
    // קבלת ההגדרות (למשל, כדי להציג בממשק מתי צריך להגיע)
    if (request.method === "GET") {
        const targetTime = await getSetting(env, 'target_arrival_time');
        return { target_arrival_time: targetTime };
    }
    
    // עדכון שעת הגעה
    if (request.method === "POST") {
        const body = await request.json();
        if (body.target_arrival_time) {
            await env.DB.prepare(
                "INSERT INTO settings (key, value) VALUES ('target_arrival_time', ?) ON CONFLICT(key) DO UPDATE SET value = ?"
            ).bind(body.target_arrival_time, body.target_arrival_time).run();
        }
        return { message: "הגדרות עודכנו בהצלחה" };
    }
}
