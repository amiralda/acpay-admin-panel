import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import GroupNew from './pages/GroupNew'
import GroupDetail from './pages/GroupDetail'
import MemberAdd from './pages/MemberAdd'
import Disputes from './pages/Disputes'
import CycleAdvance from './pages/CycleAdvance'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={
            <PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>
          } />
          <Route path="/groups/new" element={
            <PrivateRoute><Layout><GroupNew /></Layout></PrivateRoute>
          } />
          <Route path="/groups/:id" element={
            <PrivateRoute><Layout><GroupDetail /></Layout></PrivateRoute>
          } />
          <Route path="/groups/:id/members/add" element={
            <PrivateRoute><Layout><MemberAdd /></Layout></PrivateRoute>
          } />
          <Route path="/groups/:id/cycle" element={
            <PrivateRoute><Layout><CycleAdvance /></Layout></PrivateRoute>
          } />
          <Route path="/disputes" element={
            <PrivateRoute><Layout><Disputes /></Layout></PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
