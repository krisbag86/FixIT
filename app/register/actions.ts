"use server";

export async function registerAction(_previousState: string | undefined, _formData: FormData): Promise<string | undefined> {
  // Self-registration cannot verify ownership of a bagietka.pl address.
  // Keep account creation on the admin invitation flow until email
  // verification is implemented.
  return "Rejestracja jest wyłączona. Skontaktuj się z administratorem, aby utworzyć konto.";

}
