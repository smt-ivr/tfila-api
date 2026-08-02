import { getWeeklyData } from './reports.js';
import { getCurrentIsraelTime } from './utils.js';

export async function handleSendEmail(request, env) {
    const url = new URL(request.url);
    
    const emailsArray = [];
    for (const [key, value] of url.searchParams.entries()) {
        if (key.toLowerCase().startsWith('email') && value.trim() !== '') {
            const parts = value.split(',').map(e => e.trim()).filter(e => e.length > 0);
            emailsArray.push(...parts);
        }
    }
    
    const uniqueEmails = [...new Set(emailsArray)];
    
    if (uniqueEmails.length === 0) {
        throw new Error("No valid email addresses provided");
    }

    const current = getCurrentIsraelTime();
    const dateParam = url.searchParams.get('date') || current.date;
    
    const data = await getWeeklyData(env, dateParam);
    
    if (data.isBeforeStart) {
        throw new Error("המערכת טרם התחילה לפעול בתאריך זה, לא ניתן לשלוח דוח.");
    }

    const htmlContent = buildEmailHTML(data, current.date);

    const parashaText = data.parasha ? ` - ${data.parasha}` : '';
    const yearText = data.heYear ? ` ${data.heYear}` : '';
    const subjectLine = `דוח נוכחות מבצע תפילה${parashaText}${yearText}`;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'מערכת תפילה <tfila@smti.uk>',
            to: uniqueEmails,
            subject: subjectLine,
            html: htmlContent
        })
    });

    if (!res.ok) {
        throw new Error("Failed to send email");
    }

    return { message: "Email sent successfully to: " + uniqueEmails.join(', ') };
}

function buildEmailHTML(data, realTodayStr) {
    let rows = '';
    
    // יצירת כותרות הימים
    const dayHeaders = data.daysToShow.map(d => {
        const isToday = d.dateStr === realTodayStr;
        const bgColor = isToday ? '#EEF2FF' : '#F1F5F9'; // indigo-50 או slate-100
        const textColor = isToday ? '#4338CA' : '#1E293B'; // indigo-700 או slate-800
        const todayMarker = isToday ? '<br><span style="font-size:10px; background-color: #4F46E5; color: white; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px; font-weight: bold;">היום</span>' : '';
        
        return `<th colspan="2" style="border: 1px solid #CBD5E1; padding: 10px; background-color: ${bgColor}; color: ${textColor}; text-align: center; vertical-align: middle; font-size: 14px; font-weight: bold;">
            ${d.name}${todayMarker}
        </th>`;
    }).join('');

    // תת-כותרות (זמן והתנהגות)
    const subHeaders = data.daysToShow.map(d => {
        const isToday = d.dateStr === realTodayStr;
        const bgColor = isToday ? '#F8FAFC' : '#F8FAFC'; 
        
        return `<th style="border: 1px solid #CBD5E1; padding: 6px; background-color: ${bgColor}; color: #64748B; text-align: center; font-size: 12px; font-weight: bold; vertical-align: middle;">זמן</th>
                <th style="border: 1px solid #CBD5E1; padding: 6px; background-color: ${bgColor}; color: #64748B; text-align: center; font-size: 12px; font-weight: bold; vertical-align: middle;">התנהגות</th>`;
    }).join('');

    // יצירת תוכן הטבלה (התלמידים)
    data.report.forEach(student => {
        let cells = '';
        
        data.daysToShow.forEach(day => {
            const isToday = day.dateStr === realTodayStr;
            const isVacation = day.isVacation;
            const isFuture = day.isFuture === true;
            const cellBg = isVacation ? '#F1F5F9' : (isToday ? '#F8FAFC' : '#FFFFFF');
            const status = student.weeklyStatus[day.index];
            const hasExplicitReport = status && (status.type === 'absence' || status.type === 'late' || status.badBehavior);
            
            if (isVacation && !hasExplicitReport) {
                 cells += `
                    <td colspan="2" style="border: 1px solid #CBD5E1; padding: 8px; text-align: center; background-color: #F1F5F9; color: #94A3B8; font-size: 12px; font-weight: bold;">אין לימודים</td>
                `;
            } else if (isFuture && !hasExplicitReport) {
                cells += `
                    <td colspan="2" style="border: 1px solid #CBD5E1; padding: 8px; text-align: center; background-color: #F1F5F9; color: #CBD5E1; font-size: 12px;">-</td>
                `;
            } else {
                let timeContent = '';
                // עיצוב תואם לממשק (תגים צבעוניים מבוססי Tailwind)
                if (status.type === 'ok') {
                    timeContent = `<span style="color: #10B981; font-weight: bold; font-size: 14px;">V</span>`;
                } else if (status.type === 'absence') {
                    timeContent = `<span style="background-color: #FEE2E2; color: #B91C1C; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 14px; border: 1px solid #FECACA;">-</span>`;
                } else if (status.type === 'late') {
                    timeContent = `<span style="background-color: #FEF3C7; color: #92400E; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; border: 1px solid #FDE68A; display: inline-block; white-space: nowrap;">${status.minutes} דק'</span>`;
                }

                let behaviorContent = status.behaviorMark || '';
                if (status.badBehavior || status.behaviorMark === 'ב') {
                    behaviorContent = `<span style="background-color: #EF4444; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">ב</span>`;
                } else if (status.behaviorMark === 'א') {
                    behaviorContent = `<span style="background-color: #D1FAE5; color: #047857; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; border: 1px solid #A7F3D0;">א</span>`;
                }

                cells += `
                    <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: center; vertical-align: middle; background-color: ${cellBg};">${timeContent}</td>
                    <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: center; vertical-align: middle; background-color: ${cellBg};">${behaviorContent}</td>
                `;
            }
        });
        
        rows += `
            <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; font-size: 14px; color: #1E293B; text-align: center; vertical-align: middle; background-color: #FFFFFF;">${student.first_name}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; font-size: 14px; color: #1E293B; text-align: center; vertical-align: middle; background-color: #FFFFFF;">${student.last_name}</td>
                <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: center; vertical-align: middle; background-color: #F8FAFC;">
                    <span style="background-color: #F1F5F9; color: #475569; font-size: 12px; font-weight: bold; padding: 2px 8px; border-radius: 4px; border: 1px solid #E2E8F0; display: inline-block;">${student.class_name || '-'}</span>
                </td>
                ${cells}
            </tr>
        `;
    });

    const parashaText = data.parasha ? ` - ${data.parasha}` : '';
    const yearText = data.heYear ? ` ${data.heYear}` : '';
    const titleLine = `דוח נוכחות${parashaText}${yearText}`;

    return `
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
        </head>
        <body dir="rtl" style="margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background-color: #F8FAFC; direction: rtl; text-align: center;">
            <div style="max-width: 1100px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); direction: rtl;">
                
                <!-- קישור עליון -->
                <div style="text-align: center; margin-bottom: 24px;">
                    <a href="https://smti.uk/tfila" style="display: inline-block; background-color: #EEF2FF; color: #4F46E5; text-decoration: none; font-weight: bold; font-size: 14px; padding: 10px 20px; border-radius: 8px; border: 1px solid #C7D2FE;">
                        לכניסה למערכת דוחות תפילה לחצו כאן
                    </a>
                </div>

                <!-- כותרת ראשית -->
                <h2 style="color: #4338CA; margin-bottom: 24px; text-align: center; font-size: 24px; font-weight: 900; margin-top: 0;">${titleLine}</h2>
                
                <!-- טבלה -->
                <div style="overflow-x: auto;">
                    <table dir="rtl" style="border-collapse: collapse; width: 100%; border: 1px solid #CBD5E1; direction: rtl; margin: 0 auto;">
                        <thead>
                            <tr>
                                <th rowspan="2" style="border: 1px solid #CBD5E1; padding: 10px; background-color: #F1F5F9; color: #1E293B; text-align: center; vertical-align: middle; font-size: 13px; font-weight: bold; width: 90px;">שם פרטי</th>
                                <th rowspan="2" style="border: 1px solid #CBD5E1; padding: 10px; background-color: #F1F5F9; color: #1E293B; text-align: center; vertical-align: middle; font-size: 13px; font-weight: bold; width: 90px;">משפחה</th>
                                <th rowspan="2" style="border: 1px solid #CBD5E1; padding: 10px; background-color: #F1F5F9; color: #1E293B; text-align: center; vertical-align: middle; font-size: 13px; font-weight: bold; width: 70px;">כיתה</th>
                                ${dayHeaders}
                            </tr>
                            <tr>
                                ${subHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
                
                <!-- קרדיט ולוגו תחתון -->
                <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #E2E8F0; text-align: center;">
                    <p style="font-size: 12px; color: #64748B; margin-bottom: 8px; font-weight: bold;">הופק ע"י מערכת דוחות מבצע תפילה</p>
                    <a href="https://smti.uk/tfila" style="text-decoration: none; display: inline-block;">
                        <img src="https://smt-tel-manager.netlify.app/smt.png" alt="SMT Logo" style="height: 50px; opacity: 0.9; display: block; margin: 0 auto;">
                    </a>
                </div>
                
            </div>
        </body>
        </html>
    `;
}
