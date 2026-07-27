import { getWeeklyData } from './reports.js';
import { getCurrentIsraelTime } from './utils.js';

export async function handleSendEmail(request, env) {
    const url = new URL(request.url);
    
    // איסוף כל הפרמטרים שמתחילים במילה email (כגון email, email1, email2)
    const emailsArray = [];
    for (const [key, value] of url.searchParams.entries()) {
        if (key.toLowerCase().startsWith('email') && value.trim() !== '') {
            // במקרה שעדיין ישחילו פסיק איכשהו, נפריד ונוסיף
            const parts = value.split(',').map(e => e.trim()).filter(e => e.length > 0);
            emailsArray.push(...parts);
        }
    }
    
    // סינון כפילויות (אם נשלח אותו מייל פעמיים בטעות)
    const uniqueEmails = [...new Set(emailsArray)];
    
    if (uniqueEmails.length === 0) {
        throw new Error("No valid email addresses provided");
    }

    const current = getCurrentIsraelTime();
    const data = await getWeeklyData(env, current.date);
    
    const htmlContent = buildEmailHTML(data, current.date);

    const parashaText = data.parasha ? ` - ${data.parasha}` : '';
    const yearText = data.heYear ? ` ${data.heYear}` : '';
    const subjectLine = `דוח נוכחות יומי${parashaText}${yearText}`;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'מערכת נוכחות <tfila@smti.uk>',
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

function buildEmailHTML(data, currentDateStr) {
    let rows = '';
    
    const dayHeaders = data.daysToShow.map(d => {
        const isToday = d.dateStr === currentDateStr;
        const bgColor = isToday ? '#FEF08A' : '#F3F4F6';
        const todayMarker = isToday ? '<br><span style="font-size:13px; color:#B45309; font-weight:normal;">(היום)</span>' : '';
        
        return `<th colspan="2" style="border: 1px solid #D1D5DB; padding: 8px; background-color: ${bgColor}; color: #374151; text-align: center; vertical-align: middle; font-size: 16px;">
            ${d.name}${todayMarker}
        </th>`;
    }).join('');

    const subHeaders = data.daysToShow.map(d => {
        const isToday = d.dateStr === currentDateStr;
        const bgColor = isToday ? '#FEF9C3' : '#F9FAFB';
        
        return `<th style="border: 1px solid #D1D5DB; padding: 4px 6px; background-color: ${bgColor}; color: #4B5563; text-align: center; font-size: 14px; font-weight: normal; vertical-align: middle;">זמן</th>
                <th style="border: 1px solid #D1D5DB; padding: 4px 6px; background-color: ${bgColor}; color: #4B5563; text-align: center; font-size: 14px; font-weight: normal; vertical-align: middle;">התנהגות</th>`;
    }).join('');

    data.report.forEach(student => {
        let cells = '';
        
        data.daysToShow.forEach(day => {
            const isToday = day.dateStr === currentDateStr;
            const cellBg = isToday ? '#FEF9C3' : '#FFFFFF';
            const status = student.weeklyStatus[day.index];
            let timeContent = '';
            
            if (status.type === 'ok') {
                timeContent = `<span style="color: #059669; font-weight: bold; font-size: 17px;">V</span>`;
            } else if (status.type === 'absence') {
                timeContent = `<span style="color: #DC2626; font-weight: bold; font-size: 22px;">-</span>`;
            } else if (status.type === 'late') {
                timeContent = `<span style="color: #D97706; font-weight: bold; font-size: 15px;">${status.minutes} דק' איחור</span>`;
            }

            cells += `
                <td style="border: 1px solid #E5E7EB; padding: 6px; text-align: center; vertical-align: middle; min-width: 55px; background-color: ${cellBg};">${timeContent}</td>
                <td style="border: 1px solid #E5E7EB; padding: 6px; text-align: center; vertical-align: middle; font-weight: bold; font-size: 16px; min-width: 55px; background-color: ${cellBg};">${status.behaviorMark}</td>
            `;
        });
        
        rows += `
            <tr>
                <td style="border: 1px solid #E5E7EB; padding: 8px; font-weight: bold; font-size: 15px; color: #111827; text-align: center; vertical-align: middle;">${student.first_name}</td>
                <td style="border: 1px solid #E5E7EB; padding: 8px; font-weight: bold; font-size: 15px; color: #111827; text-align: center; vertical-align: middle;">${student.last_name}</td>
                <td style="border: 1px solid #E5E7EB; padding: 8px; font-size: 15px; color: #4B5563; text-align: center; vertical-align: middle;">${student.class_name || ''}</td>
                ${cells}
            </tr>
        `;
    });

    const parashaText = data.parasha ? ` - ${data.parasha}` : '';
    const yearText = data.heYear ? ` ${data.heYear}` : '';
    const titleLine = `דוח נוכחות יומי${parashaText}${yearText}`;

    return `
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; background-color: #F9FAFB; padding: 20px; direction: rtl; text-align: center; }
                .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px rgba(0,0,0,0.05); direction: rtl; }
                h2 { color: #1F2937; margin-bottom: 20px; text-align: center; font-size: 26px; font-weight: bold; }
                table { border-collapse: collapse; width: 100%; border: 1px solid #D1D5DB; direction: rtl; margin: 0 auto; }
            </style>
        </head>
        <body dir="rtl" style="direction: rtl; text-align: center;">
            <div class="container" dir="rtl" style="direction: rtl;">
                <h2>${titleLine}</h2>
                <table dir="rtl" style="direction: rtl; width: 100%;">
                    <thead>
                        <tr>
                            <th rowspan="2" style="border: 1px solid #D1D5DB; padding: 8px; background-color: #F3F4F6; color: #374151; text-align: center; vertical-align: middle; font-size: 15px; font-weight: bold;">שם פרטי</th>
                            <th rowspan="2" style="border: 1px solid #D1D5DB; padding: 8px; background-color: #F3F4F6; color: #374151; text-align: center; vertical-align: middle; font-size: 15px; font-weight: bold;">משפחה</th>
                            <th rowspan="2" style="border: 1px solid #D1D5DB; padding: 8px; background-color: #F3F4F6; color: #374151; text-align: center; vertical-align: middle; font-size: 15px; font-weight: bold;">כיתה</th>
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
