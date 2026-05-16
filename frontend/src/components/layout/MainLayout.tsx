import { Outlet } from 'react-router-dom'
import PteroSidebar from './PteroSidebar'

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — solid navy, above everything */}
      <PteroSidebar />

      {/* Content area — has background image */}
      <div
        className="relative flex-1 overflow-hidden"
        style={{
          backgroundImage: 'url(/bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay on content only, not sidebar */}
        <div className="absolute inset-0 bg-black/55 z-0" />

        <main className="relative z-10 h-full overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
