export async function sendEmailReport(env, toEmail, htmlContent) {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'מערכת נוכחות <tfila@smti.uk>',
            to: toEmail,
            subject: 'דוח נוכחות וחריגים שבועי',
            html: htmlContent
        })
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`שגיאה בשליחת המייל דרך Resend: ${errorText}`);
    }

    return await res.json();
}
