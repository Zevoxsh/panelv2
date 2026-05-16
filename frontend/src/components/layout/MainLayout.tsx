import { Outlet } from 'react-router-dom'
import PteroSidebar from './PteroSidebar'

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — solid void, outside the bg */}
      <PteroSidebar />

      {/* Content — bg.jpg with deep tinted overlay */}
      <div
        className="relative flex-1 overflow-hidden"
        style={{
          backgroundImage: 'url(/bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Blue-black tinted overlay — richer than pure black */}
        <div className="absolute inset-0 z-0" style={{ background: 'rgba(3,7,20,0.78)' }} />

        <main className="relative z-10 h-full overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
