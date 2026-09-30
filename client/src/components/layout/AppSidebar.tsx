import { Store } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import { useSettings } from '@/api/settings';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { APP_VERSION } from '@/lib/version';
import { activeNav, NAV, NAV_GROUPS } from '@/router';

/** Sidebar máy tính: tên cửa hàng, menu theo nhóm, version ở chân. Điện thoại dùng thanh dưới (AppShell). */
export function AppSidebar() {
  const { data: settings } = useSettings();
  const { pathname } = useLocation();
  const current = activeNav(pathname);
  return (
    <Sidebar collapsible="none" className="sticky top-0 hidden h-svh border-r md:flex">
      <SidebarHeader className="border-b px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-heading font-semibold text-foreground">{settings?.storeName || 'Tạp hóa'}</div>
            {settings?.storeAddress && <div className="truncate text-xs text-muted-foreground">{settings.storeAddress}</div>}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((g) => (
          <SidebarGroup key={g.key}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.filter((n) => n.group === g.key).map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={current?.to === to} className="h-9 text-sm">
                      <NavLink to={to}>
                        <Icon />
                        {label}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t px-4 py-3 text-xs text-muted-foreground">Phiên bản {APP_VERSION}</SidebarFooter>
    </Sidebar>
  );
}
