import { getCurrentIsraelTime, getSetting } from './utils.js';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MAX_RANGE_DAYS = 400;

function parseISO(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return isNaN(dt.getTime()) ? null : dt;
}

function toISO(dt) {
    return dt.toISOString().split('T')[0];
}

function httpError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

/**
 * דוח היסטוריה לתלמיד בודד בטווח תאריכים.
 * GET /student-report?code=123&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * מחזיר שורה לכל יום (ראשון-שישי) עם סטטוס, וכן סיכום כללי וסיכום חודשי.
 */
export async function handleStudentReport(request, env) {
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || '').trim();
    const today = getCurrentIsraelTime().date;

    if (!code) throw httpError('חסר קוד תלמיד');

    let fromDt = parseISO(url.searchParams.get('from'));
    let toDt = parseISO(url.searchParams.get('to') || today);
    if (!fromDt || !toDt) throw httpError('טווח תאריכים לא תקין');
    if (fromDt > toDt) [fromDt, toDt] = [toDt, fromDt];

    const rangeDays = Math.round((toDt - fromDt) / 86400000) + 1;
    if (rangeDays > MAX_RANGE_DAYS) throw httpError(`ניתן להפיק דוח לטווח של עד ${MAX_RANGE_DAYS} ימים`);

    const student = await env.DB.prepare('SELECT * FROM students WHERE code = ?').bind(code).first();
    if (!student) throw httpError('התלמיד לא נמצא במערכת', 404);

    const requestedFrom = toISO(fromDt);
    const requestedTo = toISO(toDt);
    const systemStartDate = await getSetting(env, 'system_start_date', '2000-01-01');

    // צמצום הטווח לימים רלוונטיים בלבד: לא לפני הפעלת המערכת ולא אחרי היום
    const startDt = parseISO(systemStartDate);
    const todayDt = parseISO(today);
    if (startDt && fromDt < startDt) fromDt = startDt;
    if (todayDt && toDt > todayDt) toDt = todayDt;
    const from = toISO(fromDt);
    const to = toISO(toDt);

    const [{ results: exceptions }, { results: vacations }] = await Promise.all([
        env.DB.prepare('SELECT date, type, minutes, bad_behavior FROM exceptions WHERE student_code = ? AND date >= ? AND date <= ?')
            .bind(code, from, to).all(),
        env.DB.prepare('SELECT date FROM vacations WHERE date >= ? AND date <= ?')
            .bind(from, to).all()
    ]);

    const exceptionMap = new Map(exceptions.map(e => [e.date, e]));
    const vacationSet = new Set(vacations.map(v => v.date));

    const summary = {
        schoolDays: 0,       // ימי לימוד בפועל (ללא חופשות/עתיד/לפני הפעלה)
        presentDays: 0,      // הגיע (בזמן או באיחור)
        onTimeDays: 0,
        lateDays: 0,
        lateMinutes: 0,
        absenceDays: 0,
        badBehaviorDays: 0,
        goodBehaviorDays: 0,
        vacationDays: 0
    };
    const monthly = new Map();
    const days = [];

    for (let dt = new Date(fromDt); dt <= toDt; dt.setUTCDate(dt.getUTCDate() + 1)) {
        const weekday = dt.getUTCDay();
        if (weekday === 6) continue; // שבת

        const date = toISO(dt);
        const ex = exceptionMap.get(date);
        const type = ex && ex.type ? ex.type : null;
        const badBehavior = !!(ex && ex.bad_behavior === 1);
        const hasExplicit = !!(type === 'absence' || type === 'late' || badBehavior);

        let status;
        if (date < systemStartDate) status = 'before_start';
        else if (vacationSet.has(date) && !hasExplicit) status = 'vacation';
        else if (date > today && !hasExplicit) status = 'future';
        else if (type === 'absence') status = 'absence';
        else if (type === 'late') status = 'late';
        else status = 'ok';

        const minutes = status === 'late' ? (parseInt(ex.minutes, 10) || 0) : null;
        let behavior = '';
        if (status === 'ok' || status === 'late') behavior = badBehavior ? 'ב' : 'א';
        else if (status === 'absence' && badBehavior) behavior = 'ב';

        days.push({ date, weekday, dayName: DAY_NAMES[weekday], status, minutes, behavior });

        if (status === 'before_start' || status === 'future') continue;

        const monthKey = date.slice(0, 7);
        if (!monthly.has(monthKey)) {
            monthly.set(monthKey, { month: monthKey, schoolDays: 0, onTimeDays: 0, lateDays: 0, lateMinutes: 0, absenceDays: 0, badBehaviorDays: 0, vacationDays: 0 });
        }
        const m = monthly.get(monthKey);

        if (status === 'vacation') {
            summary.vacationDays++; m.vacationDays++;
            continue;
        }

        summary.schoolDays++; m.schoolDays++;
        if (status === 'absence') { summary.absenceDays++; m.absenceDays++; }
        if (status === 'late') {
            summary.lateDays++; m.lateDays++;
            summary.lateMinutes += minutes; m.lateMinutes += minutes;
        }
        if (status === 'ok') { summary.onTimeDays++; m.onTimeDays++; }
        if (behavior === 'ב') { summary.badBehaviorDays++; m.badBehaviorDays++; }
        if (behavior === 'א') summary.goodBehaviorDays++;
    }

    summary.presentDays = summary.onTimeDays + summary.lateDays;
    const pct = (n, d) => d ? Math.round((n / d) * 1000) / 10 : null;
    summary.attendanceRate = pct(summary.presentDays, summary.schoolDays);
    summary.punctualityRate = pct(summary.onTimeDays, summary.schoolDays);
    summary.behaviorRate = pct(summary.presentDays - summary.badBehaviorDays, summary.presentDays);
    summary.avgLateMinutes = summary.lateDays ? Math.round((summary.lateMinutes / summary.lateDays) * 10) / 10 : 0;

    const monthlyList = [...monthly.values()].map(m => ({
        ...m,
        attendanceRate: pct(m.schoolDays - m.absenceDays, m.schoolDays)
    }));

    return {
        student: {
            code: student.code,
            first_name: student.first_name,
            last_name: student.last_name,
            class_name: student.class_name
        },
        from,
        to,
        requestedFrom,
        requestedTo,
        today,
        systemStartDate,
        generatedAt: getCurrentIsraelTime(),
        summary,
        monthly: monthlyList,
        days
    };
}
