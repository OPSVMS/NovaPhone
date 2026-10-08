"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { login, register, requestPasswordReset, resendPasswordReset, resetPassword, type FormState } from "@/app/actions/auth";
import { OTP_LENGTH, OtpInput, ResendCode, emptyOtp } from "@/components/app/otp-form";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={shown}
      className="inline-flex size-9 items-center justify-center rounded-[10px] text-subtle transition-colors duration-200 hover:bg-white/[0.05] hover:text-fg [&_svg]:size-[18px]"
    >
      {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
    </button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, undefined);
  // Controlled so values survive React's automatic form reset after an action.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state?.error ? <Alert variant="error">{state.error}</Alert> : null}
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        placeholder="tu@correo.com"
        leading={<Mail />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        label="Contraseña"
        name="password"
        type={shown ? "text" : "password"}
        autoComplete="current-password"
        required
        placeholder="••••••••"
        leading={<Lock />}
        trailing={<PasswordToggle shown={shown} onToggle={() => setShown((s) => !s)} />}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={state?.error ? true : undefined}
      />
      <div className="-mt-2 flex justify-end">
        <Link
          href={email.includes("@") ? `/recuperar?email=${encodeURIComponent(email.trim())}` : "/recuperar"}
          className="text-[13px] font-medium text-lavender underline-offset-4 hover:text-lavender-soft hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <SubmitButton fullWidth size="lg" pendingText="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(register, undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const short = password.length > 0 && password.length < 8;

  return (
    <form action={action} className="flex flex-col gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state?.error ? <Alert variant="error">{state.error}</Alert> : null}
      <Field
        label="Nombre"
        name="name"
        autoComplete="name"
        autoCapitalize="words"
        required
        minLength={2}
        maxLength={80}
        placeholder="Tu nombre"
        leading={<User />}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        placeholder="tu@correo.com"
        hint="Ahí te enviaremos tu eSIM y tus recibos."
        leading={<Mail />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        label="Contraseña"
        name="password"
        type={shown ? "text" : "password"}
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={128}
        placeholder="Mínimo 8 caracteres"
        leading={<Lock />}
        trailing={<PasswordToggle shown={shown} onToggle={() => setShown((s) => !s)} />}
        hint={short ? `Te faltan ${8 - password.length} caracteres` : "Mínimo 8 caracteres."}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <SubmitButton fullWidth size="lg" pendingText="Creando tu cuenta…">
        Crear cuenta
      </SubmitButton>
      <p className="text-center text-[13px] leading-relaxed text-subtle">
        Al continuar aceptas los{" "}
        <Link href="/terminos" className="text-muted underline-offset-4 hover:text-fg hover:underline">
          términos
        </Link>{" "}
        y el{" "}
        <Link href="/privacidad" className="text-muted underline-offset-4 hover:text-fg hover:underline">
          aviso de privacidad
        </Link>
        .
      </p>
    </form>
  );
}

export function ResetRequestForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, undefined);
  const [email, setEmail] = useState(defaultEmail);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.error ? <Alert variant="error">{state.error}</Alert> : null}
      <Field
        label="Correo de tu cuenta"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        autoFocus
        placeholder="tu@correo.com"
        leading={<Mail />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <SubmitButton fullWidth size="lg" pendingText="Enviando código…">
        Enviar código
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ email }: { email: string }) {
  const [digits, setDigits] = useState<string[]>(emptyOtp);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const res = await resetPassword(prev, formData);
    if (res?.error && /código/i.test(res.error)) {
      setDigits(emptyOtp());
      requestAnimationFrame(() => otpRefs.current[0]?.focus());
    }
    return res;
  }, undefined);
  const code = digits.join("");
  const short = password.length > 0 && password.length < 8;

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="code" value={code} />
        {state?.error ? <Alert variant="error">{state.error}</Alert> : null}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-fg">Código de 6 dígitos</legend>
          <OtpInput
            digits={digits}
            onDigitsChange={setDigits}
            onComplete={() => requestAnimationFrame(() => passwordRef.current?.focus())}
            disabled={pending}
            invalid={!!state?.error && /código/i.test(state.error)}
            inputRefs={otpRefs}
            label="Código para restablecer tu contraseña"
          />
        </fieldset>
        <Field
          ref={passwordRef}
          label="Contraseña nueva"
          name="password"
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          placeholder="Mínimo 8 caracteres"
          leading={<Lock />}
          trailing={<PasswordToggle shown={shown} onToggle={() => setShown((s) => !s)} />}
          hint={short ? `Te faltan ${8 - password.length} caracteres` : "Mínimo 8 caracteres."}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton fullWidth size="lg" disabled={code.length !== OTP_LENGTH || password.length < 8} pendingText="Guardando…">
          Guardar y entrar
        </SubmitButton>
      </form>
      <ResendCode
        onResend={() => resendPasswordReset(email)}
        onSent={() => {
          setDigits(emptyOtp());
          otpRefs.current[0]?.focus();
        }}
      />
    </div>
  );
}
