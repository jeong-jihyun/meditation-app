import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
import Admin from "./admin/Admin.jsx";

// /admin 주소면 관리자 화면, 그 밖에는 명상 앱
const isAdmin = location.pathname.startsWith("/admin");
createRoot(document.getElementById("root")).render(isAdmin ? <Admin /> : <App />);
