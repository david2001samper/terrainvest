export const dynamic = "force-dynamic";

import { NavSidebar } from "@/components/nav-sidebar";
import { TickerTape } from "@/components/ticker-tape";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { NotificationActivitySync } from "@/components/notification-activity-sync";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <NotificationActivitySync />
      <TickerTape />
      <AnnouncementBanner />
      <div className="flex flex-1">
        <NavSidebar />
        <main className="flex-1 overflow-x-hidden">
          <div className="p-4 lg:p-8 pt-16 lg:pt-8 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
