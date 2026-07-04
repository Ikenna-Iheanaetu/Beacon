import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { SidebarShell, type SidebarNavItem } from "@/components/layout/sidebar-shell";

// Private area — never index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  // Providers don't have a patient passport — send them to their own area.
  if (session.profile.role === "provider") redirect("/provider");

  const unread = await getUnreadNotificationCount();

  const patientNav: SidebarNavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/passport", label: "My passport", icon: "passport" },
    { href: "/profile/edit", label: "Profile", icon: "profile" },
    { href: "/qr", label: "QR code", icon: "qr" },
    {
      href: "/notifications",
      label: "Notifications",
      icon: "notifications",
      badge: unread,
    },
    { href: "/access-log", label: "Access log", icon: "access-log" },
  ];

  return (
    <SidebarShell navItems={patientNav} brandHref="/dashboard">
      {children}
    </SidebarShell>
  );
}
