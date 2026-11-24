import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Navbar from './Components/Navbar/Navbar';
import Footer from './Components/Footer/Footer';
import Login from './Components/Login/Login';
import Register from './Components/Register/Register';
import Dashboard from './Components/Dashboard/Dashboard';
import Main_page from './Components/main_page/Main_page';
import ProtectedRoute from './Components/ProtectedRoute/ProtectedRoute';
import CodeUpload from './Components/CodeUpload/CodeUpload';
import SnippetsList from './Components/SnippetsList/SnippetsList';
import SnippetDetails from './Components/SnippetDetails/SnippetDetails';

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/main_page" replace />} />
        <Route path="/main_page" element={<Main_page />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<CodeUpload />} />
          <Route path="/snippets" element={<SnippetsList />} />
          <Route path="/snippets/:id" element={<SnippetDetails />} />
        </Route>
      </Routes>
      <Footer />
    </>
  );
}

export default App;