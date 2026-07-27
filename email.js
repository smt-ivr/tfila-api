import { getWeeklyData } from './reports.js';
import { getCurrentIsraelTime } from './utils.js';

export async function handleSendEmail(request, env) {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
        throw new Error("Missing email parameter");
    }

    const current = getCurrentIsraelTime();
    const data = await getWeeklyData(env, current.date);
    
    const htmlContent = buildEmailHTML(data);

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'מערכת נוכחות <tfila@smti.uk>',
            to: email,
            subject: `דוח נוכחות שבועי (${data.weekStart} עד ${data.weekEnd})`,
            html: htmlContent
        })
    });

    if (!res.ok) {
        throw new Error("Failed to send email");
    }

    return { message: "Email sent successfully to: " + email };
}

function buildEmailHTML(data) {
    let rows = '';
    
    // כותרת עליונה לכל יום
    const dayHeaders = data.daysToShow.map(d => 
        `<th colspan="2" style="border: 1px solid #D1D5DB; padding: 12px; background-color: #F3F4F6; color: #374151; text-align: center;">${d.name}</th>`
    ).join('');

    // תת-כותרות (זמן | התנהגות)
    const subHeaders = data.daysToShow.map(() => 
        `<th style="border: 1px solid #D1D5DB; padding: 6px; background-color: #F9FAFB; color: #4B5563; text-align: center; font-size: 13px; font-weight: normal;">זמן</th>
         <th style="border: 1px solid #D1D5DB; padding: 6px; background-color: #F9FAFB; color: #4B5563; text-align: center; font-size: 13px; font-weight: normal;">התנהגות</th>`
    ).join('');

    data.report.forEach(student => {
        let cells = '';
        
        data.daysToShow.forEach(day => {
            const status = student.weeklyStatus[day.index];
            let timeContent = '';
            
            if (status.type === 'ok') {
                timeContent = `<span style="color: #059669; font-weight: bold; font-size: 15px;">V</span>`;
            } else if (status.type === 'absence') {
                timeContent = `<span style="color: #DC2626; font-weight: bold; font-size: 18px;">-</span>`;
            } else if (status.type === 'late') {
                timeContent = `<span style="color: #D97706; font-weight: 500;">${status.minutes} דק' איחור</span>`;
            }

            cells += `
                <td style="border: 1px solid #E5E7EB; padding: 10px; text-align: center; min-width: 60px;">${timeContent}</td>
                <td style="border: 1px solid #E5E7EB; padding: 10px; text-align: center; font-weight: bold; min-width: 60px;">${status.behaviorMark}</td>
            `;
        });
        
        rows += `
            <tr>
                <td style="border: 1px solid #E5E7EB; padding: 12px; font-weight: 600; color: #111827; text-align: right;">${student.first_name}</td>
                <td style="border: 1px solid #E5E7EB; padding: 12px; font-weight: 600; color: #111827; text-align: right;">${student.last_name}</td>
                <td style="border: 1px solid #E5E7EB; padding: 12px; color: #4B5563; text-align: center;">${student.class_name || ''}</td>
                ${cells}
            </tr>
        `;
    });

    return `
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; background-color: #F9FAFB; padding: 20px; direction: rtl; text-align: right; }
                .container { max-width: 1100px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px rgba(0,0,0,0.05); direction: rtl; }
                h2 { color: #1F2937; margin-bottom: 5px; text-align: center; font-size: 24px; }
                p.dates { text-align: center; color: #6B7280; margin-bottom: 25px; font-size: 15px; }
                table { border-collapse: collapse; width: 100%; border: 1px solid #D1D5DB; direction: rtl; }
                th, td { text-align: right; font-size: 14px; }
            </style>
        </head>
        <body dir="rtl" style="direction: rtl; text-align: right;">
            <div class="container" dir="rtl" style="direction: rtl;">
                <h2>דוח נוכחות - ${data.parasha}</h2>
                <p class="dates">מתאריך ${data.weekStart} עד ${data.weekEnd}</p>
                <table dir="rtl" style="direction: rtl; width: 100%;">
                    <thead>
                        <tr>
                            <th rowspan="2" style="border: 1px solid #D1D5DB; padding: 12px; background-color: #F3F4F6; color: #374151; text-align: right; vertical-align: middle;">שם פרטי</th>
                            <th rowspan="2" style="border: 1px solid #D1D5DB; padding: 12px; background-color: #F3F4F6; color: #374151; text-align: right; vertical-align: middle;">משפחה</th>
                            <th rowspan="2" style="border: 1px solid #D1D5DB; padding: 12px; background-color: #F3F4F6; color: #374151; text-align: center; vertical-align: middle;">כיתה</th>
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
        </body>
        </html>
    `;
}
