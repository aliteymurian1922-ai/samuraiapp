import "server-only";

type PasswordResetEmailInput = {
  to: string;
  name: string;
  resetUrl: string;
};

export type EmailDeliveryResult =
  | { sent: true; provider: "resend"; id: string | null }
  | { sent: false; provider: "resend" | "not_configured"; reason: string };

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char] ?? char,
  );
}

export function getApplicationUrl(requestOrigin?: string) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production" && requestOrigin) {
    return requestOrigin.replace(/\/$/, "");
  }

  return null;
}

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      sent: false,
      provider: "not_configured",
      reason: "Transactional email is not configured.",
    };
  }

  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(input.resetUrl);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "بازیابی رمز عبور سامورایی",
      text: `سلام ${input.name}،\n\nبرای انتخاب رمز عبور جدید از این لینک استفاده کنید:\n${input.resetUrl}\n\nاین لینک یک ساعت اعتبار دارد. اگر شما این درخواست را ثبت نکرده‌اید، این ایمیل را نادیده بگیرید.`,
      html: `
        <div dir="rtl" style="font-family:Arial,Tahoma,sans-serif;max-width:560px;margin:0 auto;line-height:1.9;color:#172033">
          <h2 style="margin:0 0 16px;font-size:22px">بازیابی رمز عبور سامورایی</h2>
          <p>سلام ${safeName}،</p>
          <p>درخواستی برای تغییر رمز عبور حساب شما ثبت شده است.</p>
          <p style="margin:28px 0">
            <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700">
              انتخاب رمز عبور جدید
            </a>
          </p>
          <p style="font-size:13px;color:#667085">این لینک یک ساعت اعتبار دارد. اگر شما این درخواست را ثبت نکرده‌اید، نیازی به انجام کاری نیست.</p>
        </div>
      `,
      tags: [{ name: "category", value: "password_reset" }],
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    console.error("[email:resend] password reset delivery failed", {
      status: response.status,
      detail,
    });
    return {
      sent: false,
      provider: "resend",
      reason: `Resend returned HTTP ${response.status}.`,
    };
  }

  const payload = (await response.json()) as { id?: string };

  return {
    sent: true,
    provider: "resend",
    id: payload.id ?? null,
  };
}
