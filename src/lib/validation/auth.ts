import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد.").max(120),
  email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست."),
  password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد."),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست."),
  password: z.string().min(1, "رمز عبور را وارد کنید."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد."),
});
