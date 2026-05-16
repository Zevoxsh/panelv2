import { Outlet } from 'react-router-dom'
import PteroSidebar from './PteroSidebar'

export default function MainLayout() {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        backgroundImage: 'url(/bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Dark overlay behind everything */}
      <div className="absolute inset-0 bg-black/50 z-0" />

      <PteroSidebar />

      <main className="relative z-10 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
