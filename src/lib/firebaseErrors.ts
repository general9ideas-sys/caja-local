export function firebaseMessage(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: string }).code)
      : "";
  const message = error instanceof Error ? error.message : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "Ese correo ya tiene cuenta. Entrá con tu contraseña.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/requires-recent-login":
      return "Correo o contraseña incorrectos.";
    case "auth/weak-password":
      return "La contraseña es demasiado corta (mínimo 6 caracteres).";
    case "auth/invalid-email":
      return "El correo no es válido.";
    case "auth/operation-not-allowed":
      return "Falta activar Correo/contraseña en Authentication.";
    case "permission-denied":
      return "Firebase rechazó el acceso. Publicá de nuevo las reglas de Firestore.";
    case "unavailable":
      return "No se pudo hablar con la base. ¿Creaste Firestore?";
    default:
      return message || "No se pudo completar. Probá de nuevo.";
  }
}
