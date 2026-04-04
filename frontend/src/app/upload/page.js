import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import ProjectForm from "../../components/ProjectForm";

export default function Dashboard() {
    return (
        <div className="main-layout">
            <Sidebar />
            <main className="content-area">
                <Header />
                <ProjectForm />
            </main>
        </div>
    );
}

