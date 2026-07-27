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
            from: 'מערכת חריגים <tfila@smti.uk>',
            to: email,
            subject: `דוח נוכחות שבועי (${data.weekStart} עד ${data.weekEnd})`,
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
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
    
    data.report.forEach(student => {
        let cells = '';
        for (let i = 0; i <= 5; i++) {
            const status = student.weeklyStatus[i];
            if (status.type === 'ok') cells += `<td style="color: green;">✓</td>`;
            else if (status.type === 'absence') cells += `<td style="color: red;">חיסור</td>`;
            else if (status.type === 'late') cells += `<td style="color: orange;">איחור (${status.minutes} דק')</td>`;
        }
        
        rows += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${student.code}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${student.first_name} ${student.last_name}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${student.class_name || ''}</td>
                ${cells.replace(/<td/g, '<td style="border: 1px solid #ddd; padding: 8px; text-align: center;"')}
            </tr>
        `;
    });

    return `
        <html dir="rtl">
        <head><style>table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }</style></head>
        <body>
            <h2>דוח נוכחות שבועי</h2>
            <p>תאריכים: ${data.weekStart} עד ${data.weekEnd}</p>
            <table>
                <tr style="background-color: #f2f2f2;">
                    <th style="border: 1px solid #ddd; padding: 8px;">קוד</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">שם</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">כיתה</th>
                    ${days.map(d => `<th style="border: 1px solid #ddd; padding: 8px;">${d}</th>`).join('')}
                </tr>
                ${rows}
            </table>
        </body>
        </html>
    `;
}
