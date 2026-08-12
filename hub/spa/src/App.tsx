import { useEffect, useState } from "react";
import StudentApp from "./student/StudentApp";
import AdminApp from "./admin/AdminApp";
import { useBranding } from "./branding";

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  useBranding();

  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);

  if (path.startsWith("/admin")) {
    return <AdminApp />;
  }
  // Students land on /login (or "/"), where they sign in before seeing exams.
  return <StudentApp />;
}
