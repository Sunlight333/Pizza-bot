import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopBar />
        <main className="flex-1 overflow-auto p-3 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
