interface ErrorToastProps {
  message: string | null;
}

export default function ErrorToast({ message }: ErrorToastProps) {
  if (!message) return null;
  return <div className="error-toast">{message}</div>;
}
