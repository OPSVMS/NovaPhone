"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { login, register, type FormState } from "@/app/actions/auth";
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
