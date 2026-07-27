import { getWeeklyData } from './reports.js';
import { getCurrentIsraelTime } from './utils.js';

export async function handleSendEmail(request, env) {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
        throw new Error("לא סופקה כתובת אימייל לשליחה");
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
            from: 'מערכת דיווחים <admin@smti.uk>',
            to: email,
            subject: `דוח מצב שבועי מפורט (${data.weekStart} עד ${data.weekEnd})`,
            html: htmlContent
        })
    });

    if (!res.ok) {
        throw new Error("שגיאה בשליחת המייל דרך שרת הדואר");
    }

    return { message: "הדוח נשלח בהצלחה למייל: " + email };
}

function buildEmailHTML(data) {
    let rows = '';
    
    const dayHeaders = data.daysToShow.map(d => 
        `<th style="border: 1px solid #D1D5DB; padding: 12px; background-color: #F3F4F6; color: #374151; text-align: right;">${d.name}</th>`
    ).join('');

    data.report.forEach(student => {
        let cells = '';
        
        data.daysToShow.forEach(day => {
            const status = student.weeklyStatus[day.index];
            if (status.type === 'ok') {
                cells += `<td style="color: #059669; font-weight: bold; font-size: 16px;">V</td>`;
            } else if (status.type === 'absence') {
                cells += `<td style="color: #DC2626; font-weight: bold; font-size: 20px;">-</td>`;
            } else if (status.type === 'late') {
                cells += `<td style="color: #D97706; font-weight: 500;">${status.minutes} דקות איחור</td>`;
            }
        });
        
        rows += `
            <tr>
                <td style="border: 1px solid #E5E7EB; padding: 12px; font-weight: 600; color: #111827;">${student.first_name}</td>
                <td style="border: 1px solid #E5E7EB; padding: 12px; font-weight: 600; color: #111827;">${student.last_name}</td>
                <td style="border: 1px solid #E5E7EB; padding: 12px; color: #4B5563;">${student.class_name || ''}</td>
                ${cells.replace(/<td/g, '<td style="border: 1px solid #E5E7EB; padding: 12px; text-align: center;"')}
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
                .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px rgba(0,0,0,0.05); direction: rtl; }
                h2 { color: #1F2937; margin-bottom: 5px; text-align: center; font-size: 24px; }
                p.dates { text-align: center; color: #6B7280; margin-bottom: 25px; font-size: 15px; }
                table { border-collapse: collapse; width: 100%; border: 1px solid #D1D5DB; direction: rtl; }
                th, td { text-align: right; font-size: 14px; }
            </style>
        </head>
        <body dir="rtl" style="direction: rtl; text-align: right;">
            <div class="container" dir="rtl" style="direction: rtl;">
                <h2>דוח מצב שבועי</h2>
                <p class="dates">מתאריך ${data.weekStart} עד ${data.weekEnd}</p>
                <table dir="rtl" style="direction: rtl; width: 100%;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #D1D5DB; padding: 12px; background-color: #F3F4F6; color: #374151; text-align: right;">שם</th>
                            <th style="border: 1px solid #D1D5DB; padding: 12px; background-color: #F3F4F6; color: #374151; text-align: right;">משפחה</th>
                            <th style="border: 1px solid #D1D5DB; padding: 12px; background-color: #F3F4F6; color: #374151; text-align: right;">כיתה</th>
                            ${dayHeaders}
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
